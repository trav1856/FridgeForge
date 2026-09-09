import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { normalizeVisibility } from "@/lib/recipe-visibility";

type Ctx = { params: Promise<{ id: string }> };

async function assertCanManage(recipeId: string, userId: string, householdId: string | null) {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return { error: "Not found" as const, status: 404 as const };
  const ok =
    recipe.ownerUserId === userId ||
    (householdId != null && recipe.householdId === householdId);
  if (!ok) return { error: "Forbidden" as const, status: 403 as const };
  return { recipe };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const householdId = await resolveHouseholdId();
    const { id: recipeId } = await ctx.params;
    const gate = await assertCanManage(recipeId, user.id, householdId);
    if ("error" in gate && gate.error) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const shares = await prisma.recipeShare.findMany({
      where: { recipeId },
      orderBy: { createdAt: "desc" },
      include: {
        toUser: { select: { id: true, email: true, name: true } },
        toHousehold: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({
      visibility: normalizeVisibility(gate.recipe!.visibility),
      shares,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Sign in" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const postSchema = z
  .object({
    email: z.string().email().optional(),
    householdId: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.email?.trim() || d.householdId), {
    message: "email or householdId required",
  });

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const householdId = await resolveHouseholdId();
    const { id: recipeId } = await ctx.params;
    const gate = await assertCanManage(recipeId, user.id, householdId);
    if ("error" in gate && gate.error) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const body = postSchema.parse(await req.json());
    const email = body.email?.trim().toLowerCase();
    let toUserId: string | null = null;
    let toHouseholdId: string | null = body.householdId ?? null;

    if (email) {
      const toUser = await prisma.user.findUnique({ where: { email } });
      toUserId = toUser?.id ?? null;
    }
    if (toHouseholdId) {
      const hh = await prisma.household.findUnique({ where: { id: toHouseholdId } });
      if (!hh) {
        return NextResponse.json({ error: "Household not found" }, { status: 404 });
      }
    }

    const share = await prisma.recipeShare.create({
      data: {
        recipeId,
        fromUserId: user.id,
        toUserEmail: email ?? null,
        toUserId,
        toHouseholdId,
      },
      include: {
        toUser: { select: { id: true, email: true, name: true } },
        toHousehold: { select: { id: true, name: true } },
      },
    });

    // Sharing implies Shared visibility (leave Global alone)
    const vis = normalizeVisibility(gate.recipe!.visibility);
    if (vis !== "global" && vis !== "shared") {
      await prisma.recipe.update({
        where: { id: recipeId },
        data: { visibility: "shared" },
      });
    }

    return NextResponse.json({ share }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Sign in to share" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to share" }, { status: 500 });
  }
}

const deleteSchema = z.object({ shareId: z.string().min(1) });

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const householdId = await resolveHouseholdId();
    const { id: recipeId } = await ctx.params;
    const gate = await assertCanManage(recipeId, user.id, householdId);
    if ("error" in gate && gate.error) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const body = deleteSchema.parse(await req.json());
    const existing = await prisma.recipeShare.findFirst({
      where: { id: body.shareId, recipeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.recipeShare.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Sign in" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
