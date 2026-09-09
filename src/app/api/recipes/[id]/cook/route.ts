import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { householdWhere } from "@/lib/household";
import { recipeIsReadable } from "@/lib/recipe-request";
import { parseStringArray, stringifyArray } from "@/lib/json";
import {
  planPantryDeductions,
  planPantryRestore,
  type PantryDeduction,
} from "@/lib/pantry-deduct";
import { cookScopeKey } from "@/lib/cook-stat";
import { pickUndoWithin24h } from "@/lib/cook-undo";

type Ctx = { params: Promise<{ id: string }> };

function parseDeductions(json: string): PantryDeduction[] {
  try {
    const raw = JSON.parse(json);
    return Array.isArray(raw) ? (raw as PantryDeduction[]) : [];
  } catch {
    return [];
  }
}

function sessionScopeWhere(
  recipeId: string,
  userId: string | null,
  householdId: string | null
) {
  if (householdId) {
    return { recipeId, householdId };
  }
  if (userId) {
    return { recipeId, userId, householdId: null as string | null };
  }
  return { recipeId, userId: null as string | null, householdId: null as string | null };
}

async function findActiveSession(
  recipeId: string,
  userId: string | null,
  householdId: string | null
) {
  return prisma.recipeCookSession.findFirst({
    where: { ...sessionScopeWhere(recipeId, userId, householdId), active: true },
    orderBy: { createdAt: "desc" },
  });
}

async function findUndoCandidateSessions(
  recipeId: string,
  userId: string | null,
  householdId: string | null
) {
  // Look back a bit past 24h so pickUndoWithin24h can filter precisely.
  const since = new Date(Date.now() - 26 * 60 * 60 * 1000);
  return prisma.recipeCookSession.findMany({
    where: {
      ...sessionScopeWhere(recipeId, userId, householdId),
      undoneAt: null,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

async function getCookCount(
  recipeId: string,
  householdId: string | null,
  userId: string | null
): Promise<number> {
  const scopeKey = cookScopeKey(householdId, userId);
  const row = await prisma.recipeCookStat.findUnique({
    where: { recipeId_scopeKey: { recipeId, scopeKey } },
  });
  return row?.cookCount ?? 0;
}

async function incrementCookCount(
  recipeId: string,
  householdId: string | null,
  userId: string | null
): Promise<number> {
  const scopeKey = cookScopeKey(householdId, userId);
  const row = await prisma.recipeCookStat.upsert({
    where: { recipeId_scopeKey: { recipeId, scopeKey } },
    create: {
      recipeId,
      scopeKey,
      householdId,
      userId,
      cookCount: 1,
    },
    update: { cookCount: { increment: 1 } },
  });
  return row.cookCount;
}

function sessionPayload(session: {
  id: string;
  active: boolean;
  deductionsJson: string;
  lowStockJson: string;
  createdAt: Date;
}) {
  return {
    id: session.id,
    active: session.active,
    deductions: parseDeductions(session.deductionsJson),
    lowStockMessages: parseStringArray(session.lowStockJson),
    createdAt: session.createdAt.toISOString(),
  };
}

async function restoreSessionDeductions(
  session: { id: string; deductionsJson: string; undoneAt: Date | null; active: boolean },
  householdId: string | null
): Promise<{ restoredCount: number; alreadyUndone: boolean }> {
  if (session.undoneAt != null) {
    return { restoredCount: 0, alreadyUndone: true };
  }

  const deductions = parseDeductions(session.deductionsJson);
  const restores = planPantryRestore(deductions);

  for (const r of restores) {
    const item = await prisma.pantryItem.findUnique({
      where: { id: r.pantryItemId },
    });
    if (!item) continue;
    if (householdId != null && item.householdId !== householdId) continue;
    if (householdId == null && item.householdId != null) continue;
    await prisma.pantryItem.update({
      where: { id: r.pantryItemId },
      data: { quantity: r.quantity },
    });
  }

  await prisma.recipeCookSession.update({
    where: { id: session.id },
    data: { active: false, undoneAt: new Date() },
  });

  return { restoredCount: restores.length, alreadyUndone: false };
}

/** GET — cook tally; finalize any leftover active session (commit, no restore). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: recipeId } = await ctx.params;
  const user = await getCurrentUser();
  const householdId = await resolveHouseholdId();
  const cookCount = await getCookCount(
    recipeId,
    householdId,
    user?.id ?? null
  );
  const session = await findActiveSession(
    recipeId,
    user?.id ?? null,
    householdId
  );
  // Leaving the recipe page commits the cook: keep pantry deductions, clear Cancel.
  if (session) {
    await prisma.recipeCookSession.update({
      where: { id: session.id },
      data: { active: false },
    });
  }

  const candidates = await findUndoCandidateSessions(
    recipeId,
    user?.id ?? null,
    householdId
  );
  const undoWithin24h = pickUndoWithin24h(candidates);

  return NextResponse.json({
    active: false,
    session: null,
    cookCount,
    // Informational only — client keeps visit-scoped Cancel, not this flag.
    canCancelVisit: false,
    undoWithin24h,
  });
}

/**
 * POST — start cooking: confirm deduct, apply pantry updates, persist session.
 * Body optional: { confirm?: true } | { finalize?: true, sessionId? } |
 * { makingDifferent?: true, sessionId? }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: recipeId } = await ctx.params;
    const user = await getCurrentUser();
    const householdId = await resolveHouseholdId();

    let body: {
      finalize?: boolean;
      sessionId?: string;
      makingDifferent?: boolean;
    } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    // pagehide beacon / keepalive: commit cook without restoring pantry
    if (body.finalize) {
      const session = body.sessionId
        ? await prisma.recipeCookSession.findUnique({ where: { id: body.sessionId } })
        : await findActiveSession(recipeId, user?.id ?? null, householdId);
      if (session?.active) {
        await prisma.recipeCookSession.update({
          where: { id: session.id },
          data: { active: false },
        });
      }
      return NextResponse.json({ active: false, finalized: true });
    }

    // “I’m making something different” — restore latest (or given) cook within 24h.
    if (body.makingDifferent) {
      return undoMakingDifferent(recipeId, user?.id ?? null, householdId, body.sessionId);
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: true,
        shares: {
          select: {
            toUserId: true,
            toUserEmail: true,
            toHouseholdId: true,
          },
        },
      },
    });
    if (
      !recipe ||
      !recipeIsReadable(recipe, householdId, {
        userId: user?.id,
        userEmail: user?.email,
      })
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = await findActiveSession(
      recipeId,
      user?.id ?? null,
      householdId
    );
    // Stale active session from a previous visit: commit it, then allow a new cook.
    if (existing) {
      await prisma.recipeCookSession.update({
        where: { id: existing.id },
        data: { active: false },
      });
    }

    const pantry = await prisma.pantryItem.findMany({
      where: householdWhere(householdId),
    });

    const plan = planPantryDeductions(
      recipe.ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        optional: i.optional,
      })),
      pantry.map((p) => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
      }))
    );

    // Apply deductions (keep rows at 0)
    for (const d of plan.deductions) {
      await prisma.pantryItem.update({
        where: { id: d.pantryItemId },
        data: { quantity: d.quantityAfter },
      });
    }

    const session = await prisma.recipeCookSession.create({
      data: {
        recipeId,
        userId: user?.id ?? null,
        householdId,
        active: true,
        deductionsJson: JSON.stringify(plan.deductions),
        lowStockJson: stringifyArray(plan.lowStockMessages),
      },
    });

    const cookCount = await incrementCookCount(
      recipeId,
      householdId,
      user?.id ?? null
    );

    return NextResponse.json(
      {
        active: true,
        session: sessionPayload(session),
        deducted: plan.deductions,
        skipped: plan.skipped,
        lowStockMessages: plan.lowStockMessages,
        cookCount,
        summary: {
          deductedCount: plan.deductions.length,
          lowStockCount: plan.lowStockMessages.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("cook start failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to start cook session", detail: message },
      { status: 500 }
    );
  }
}

async function undoMakingDifferent(
  recipeId: string,
  userId: string | null,
  householdId: string | null,
  sessionId?: string
) {
  let session = sessionId
    ? await prisma.recipeCookSession.findUnique({ where: { id: sessionId } })
    : null;

  if (session) {
    const inScope =
      session.recipeId === recipeId &&
      (householdId
        ? session.householdId === householdId
        : userId
          ? session.userId === userId && session.householdId == null
          : session.userId == null && session.householdId == null);
    if (!inScope) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.undoneAt != null) {
      const cookCount = await getCookCount(recipeId, householdId, userId);
      return NextResponse.json({
        active: false,
        alreadyUndone: true,
        cookCount,
        undoWithin24h: null,
        summary: { restoredCount: 0 },
      });
    }
    const age = Date.now() - session.createdAt.getTime();
    if (age > 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: "Cook is older than 24 hours" },
        { status: 400 }
      );
    }
  } else {
    const candidates = await findUndoCandidateSessions(
      recipeId,
      userId,
      householdId
    );
    const picked = pickUndoWithin24h(candidates);
    if (!picked) {
      return NextResponse.json(
        { error: "No recent cook to undo" },
        { status: 404 }
      );
    }
    session = candidates.find((s) => s.id === picked.sessionId) ?? null;
    if (!session) {
      return NextResponse.json(
        { error: "No recent cook to undo" },
        { status: 404 }
      );
    }
  }

  const result = await restoreSessionDeductions(session, householdId);
  const cookCount = await getCookCount(recipeId, householdId, userId);
  const remaining = await findUndoCandidateSessions(
    recipeId,
    userId,
    householdId
  );
  const undoWithin24h = pickUndoWithin24h(remaining);

  return NextResponse.json({
    active: false,
    makingDifferent: true,
    alreadyUndone: result.alreadyUndone,
    cookCount,
    undoWithin24h,
    summary: { restoredCount: result.restoredCount },
  });
}

/**
 * DELETE — cancel visit cook, or ?different=1 to undo a cook within 24h.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id: recipeId } = await ctx.params;
    const user = await getCurrentUser();
    const householdId = await resolveHouseholdId();
    const different =
      req.nextUrl.searchParams.get("different") === "1" ||
      req.nextUrl.searchParams.get("makingDifferent") === "1";

    if (different) {
      const sessionId =
        req.nextUrl.searchParams.get("sessionId") ?? undefined;
      return undoMakingDifferent(
        recipeId,
        user?.id ?? null,
        householdId,
        sessionId
      );
    }

    const session = await findActiveSession(
      recipeId,
      user?.id ?? null,
      householdId
    );
    if (!session) {
      return NextResponse.json({ active: false, restored: [] });
    }

    const result = await restoreSessionDeductions(session, householdId);

    const cookCount = await getCookCount(
      recipeId,
      householdId,
      user?.id ?? null
    );

    const remaining = await findUndoCandidateSessions(
      recipeId,
      user?.id ?? null,
      householdId
    );
    const undoWithin24h = pickUndoWithin24h(remaining);

    return NextResponse.json({
      active: false,
      restored: result.alreadyUndone ? [] : planPantryRestore(parseDeductions(session.deductionsJson)),
      cookCount,
      undoWithin24h,
      summary: {
        restoredCount: result.restoredCount,
      },
    });
  } catch (err) {
    console.error("cook cancel failed", err);
    return NextResponse.json(
      { error: "Failed to cancel cook session" },
      { status: 500 }
    );
  }
}
