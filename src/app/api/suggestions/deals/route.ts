import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveHouseholdId } from "@/lib/auth";
import { householdWhere } from "@/lib/household";
import { findDealsForMissingIngredients } from "@/lib/deals";
import { toPantrySnapshot, toRecipeForMatch } from "@/lib/mappers";
import { scoreRecipe } from "@/lib/suggestions";

/**
 * GET /api/suggestions/deals?recipeId=
 * Returns missing ingredients vs pantry and matching active manufacturer coupons.
 */
export async function GET(req: NextRequest) {
  const recipeId = req.nextUrl.searchParams.get("recipeId");
  if (!recipeId) {
    return NextResponse.json(
      { error: "recipeId is required" },
      { status: 400 }
    );
  }

  const householdId = await resolveHouseholdId();
  const couponWhere =
    householdId === null
      ? householdWhere(null)
      : { OR: [{ householdId: null }, { householdId }] };

  const [recipe, pantryItems, coupons] = await Promise.all([
    prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: true },
    }),
    prisma.pantryItem.findMany({ where: householdWhere(householdId) }),
    prisma.coupon.findMany({ where: couponWhere }),
  ]);

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const scored = scoreRecipe(
    toRecipeForMatch(recipe),
    pantryItems.map(toPantrySnapshot)
  );

  const deals = findDealsForMissingIngredients(
    scored.missingIngredients,
    coupons
  );

  return NextResponse.json({
    recipeId: recipe.id,
    missingIngredients: scored.missingIngredients,
    missingCount: scored.missingCount,
    canMakeNow: scored.canMakeNow,
    deals,
    dealCount: deals.length,
  });
}
