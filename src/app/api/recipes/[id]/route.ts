import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { recipeRowMatchesScope } from "@/lib/household";
import { recipeIsReadable } from "@/lib/recipe-request";
import { serializeRecipe } from "@/lib/mappers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const householdId = await resolveHouseholdId();
  const user = await getCurrentUser();
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      ingredients: true,
      shares: {
        select: {
          id: true,
          toUserId: true,
          toUserEmail: true,
          toHouseholdId: true,
          accepted: true,
          createdAt: true,
          toUser: { select: { id: true, email: true, name: true } },
          toHousehold: { select: { id: true, name: true } },
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
  const { shares, ...rest } = recipe;
  const canManageShares =
    Boolean(user) &&
    (recipe.ownerUserId === user?.id ||
      (householdId != null && recipe.householdId === householdId));
  return NextResponse.json({
    ...serializeRecipe(rest),
    shares: canManageShares ? shares : undefined,
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const householdId = await resolveHouseholdId();
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe || !recipeRowMatchesScope(recipe.householdId, householdId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Guests cannot delete shared catalog; only exact household (or guest-owned null) rows
    if (recipe.householdId == null && householdId != null) {
      return NextResponse.json(
        { error: "Cannot delete shared catalog recipe" },
        { status: 403 }
      );
    }
    await prisma.recipe.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
