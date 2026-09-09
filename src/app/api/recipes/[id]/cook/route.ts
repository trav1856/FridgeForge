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

type Ctx = { params: Promise<{ id: string }> };

function parseDeductions(json: string): PantryDeduction[] {
  try {
    const raw = JSON.parse(json);
    return Array.isArray(raw) ? (raw as PantryDeduction[]) : [];
  } catch {
    return [];
  }
}

async function findActiveSession(
  recipeId: string,
  userId: string | null,
  householdId: string | null
) {
  if (householdId) {
    return prisma.recipeCookSession.findFirst({
      where: { recipeId, householdId, active: true },
      orderBy: { createdAt: "desc" },
    });
  }
  if (userId) {
    return prisma.recipeCookSession.findFirst({
      where: { recipeId, userId, householdId: null, active: true },
      orderBy: { createdAt: "desc" },
    });
  }
  // Guest (no user, no household): match null-null active sessions for this recipe
  return prisma.recipeCookSession.findFirst({
    where: { recipeId, userId: null, householdId: null, active: true },
    orderBy: { createdAt: "desc" },
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
  return NextResponse.json({ active: false, session: null, cookCount });
}

/**
 * POST — start cooking: confirm deduct, apply pantry updates, persist session.
 * Body optional: { confirm?: true }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: recipeId } = await ctx.params;
    const user = await getCurrentUser();
    const householdId = await resolveHouseholdId();

    // pagehide beacon / keepalive: commit cook without restoring pantry
    let body: { finalize?: boolean; sessionId?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
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

/**
 * DELETE — cancel / uncheck cook: restore exact pre-deduct amounts and clear session.
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id: recipeId } = await ctx.params;
    const user = await getCurrentUser();
    const householdId = await resolveHouseholdId();

    const session = await findActiveSession(
      recipeId,
      user?.id ?? null,
      householdId
    );
    if (!session) {
      return NextResponse.json({ active: false, restored: [] });
    }

    const deductions = parseDeductions(session.deductionsJson);
    const restores = planPantryRestore(deductions);

    for (const r of restores) {
      const item = await prisma.pantryItem.findUnique({
        where: { id: r.pantryItemId },
      });
      if (!item) continue;
      // Only restore if still in this household scope
      if (householdId != null && item.householdId !== householdId) continue;
      if (householdId == null && item.householdId != null) continue;
      await prisma.pantryItem.update({
        where: { id: r.pantryItemId },
        data: { quantity: r.quantity },
      });
    }

    await prisma.recipeCookSession.update({
      where: { id: session.id },
      data: { active: false },
    });

    const cookCount = await getCookCount(
      recipeId,
      householdId,
      user?.id ?? null
    );

    return NextResponse.json({
      active: false,
      restored: restores,
      cookCount,
      summary: {
        restoredCount: restores.length,
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
