import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findDealsForMissingIngredients } from "@/lib/deals";
import { toPantrySnapshot, toRecipeForMatch } from "@/lib/mappers";
import { suggestMeals } from "@/lib/suggestions";

export async function GET(req: NextRequest) {
  const struggleMode = req.nextUrl.searchParams.get("struggle") === "1";
  const maxMissing = Number(req.nextUrl.searchParams.get("maxMissing") || "2");

  const [pantryItems, recipes, coupons] = await Promise.all([
    prisma.pantryItem.findMany(),
    prisma.recipe.findMany({ include: { ingredients: true } }),
    prisma.coupon.findMany(),
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
