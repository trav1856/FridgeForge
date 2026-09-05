import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveHouseholdId } from "@/lib/auth";
import { householdWhere } from "@/lib/household";
import { findDealsForMissingIngredients } from "@/lib/deals";
import { toPantrySnapshot, toRecipeForMatch } from "@/lib/mappers";
import { suggestMeals } from "@/lib/suggestions";

export async function GET(req: NextRequest) {
  const householdId = await resolveHouseholdId();
  const struggleMode = req.nextUrl.searchParams.get("struggle") === "1";
  const maxMissing = Number(req.nextUrl.searchParams.get("maxMissing") || "2");

  const couponWhere =
    householdId === null
      ? householdWhere(null)
      : { OR: [{ householdId: null }, { householdId }] };

  const [pantryItems, recipes, coupons] = await Promise.all([
    prisma.pantryItem.findMany({ where: householdWhere(householdId) }),
    prisma.recipe.findMany({
      where: householdWhere(householdId),
      include: { ingredients: true },
    }),
    prisma.coupon.findMany({ where: couponWhere }),
  ]);

  const pantry = pantryItems.map(toPantrySnapshot);
  const recipeData = recipes.map(toRecipeForMatch);
  const suggestions = suggestMeals(recipeData, pantry, {
    struggleMode,
    maxMissing: Number.isFinite(maxMissing) ? maxMissing : 2,
  }).map((s) => ({
    ...s,
    deals: findDealsForMissingIngredients(s.missingIngredients, coupons),
  }));

  return NextResponse.json({
    struggleMode,
    pantryCount: pantry.length,
    suggestions,
  });
}
