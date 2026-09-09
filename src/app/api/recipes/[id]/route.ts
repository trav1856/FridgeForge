import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveHouseholdId } from "@/lib/auth";
import { recipeRowMatchesScope } from "@/lib/household";
import { serializeRecipe } from "@/lib/mappers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const householdId = await resolveHouseholdId();
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: true },
  });
  if (!recipe || !recipeRowMatchesScope(recipe.householdId, householdId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(serializeRecipe(recipe));
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
