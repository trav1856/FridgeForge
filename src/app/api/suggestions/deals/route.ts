import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveHouseholdId } from "@/lib/auth";
import { householdWhere, recipeRowMatchesScope } from "@/lib/household";
import { parseGuestPantry } from "@/lib/guest-pantry";
import { sampleCouponsForMatching } from "@/lib/sample-coupons";
import { findDealsForMissingIngredients } from "@/lib/deals";
import { toPantrySnapshot, toRecipeForMatch } from "@/lib/mappers";
import { scoreRecipe } from "@/lib/suggestions";

/**
 * GET /api/suggestions/deals?recipeId=
 * Returns missing ingredients vs pantry and matching active manufacturer coupons.
 */
export async function GET(req: NextRequest) {
  return deals(req.nextUrl.searchParams.get("recipeId"), undefined);
}

/** POST { recipeId, pantry }: guests, read-only, using the browser demo pantry. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { recipeId?: unknown; pantry?: unknown }
    | null;
  const recipeId =
    typeof body?.recipeId === "string" ? body.recipeId : req.nextUrl.searchParams.get("recipeId");
  return deals(recipeId, body?.pantry);
}

async function deals(recipeId: string | null, guestPantryRaw: unknown) {
  if (!recipeId) {
    return NextResponse.json(
      { error: "recipeId is required" },
      { status: 400 }
    );
  }

  const householdId = await resolveHouseholdId();
  const [recipe, pantryItems, dbCoupons] = await Promise.all([
    prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: true },
    }),
    householdId
      ? prisma.pantryItem.findMany({ where: householdWhere(householdId) })
      : Promise.resolve([]),
    householdId
      ? prisma.coupon.findMany({ where: householdWhere(householdId) })
      : Promise.resolve([]),
  ]);
  const pantry = householdId
    ? pantryItems.map(toPantrySnapshot)
    : parseGuestPantry(guestPantryRaw);
  const coupons = householdId ? dbCoupons : sampleCouponsForMatching();

  if (!recipe || !recipeRowMatchesScope(recipe.householdId, householdId)) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const scored = scoreRecipe(toRecipeForMatch(recipe), pantry);

  const found = findDealsForMissingIngredients(
    scored.missingIngredients,
    coupons
  );

  return NextResponse.json({
    recipeId: recipe.id,
    missingIngredients: scored.missingIngredients,
    missingCount: scored.missingCount,
    canMakeNow: scored.canMakeNow,
    pantryCount: pantry.length,
    demoPantry: !householdId,
    deals: found,
    dealCount: found.length,
  });
}
