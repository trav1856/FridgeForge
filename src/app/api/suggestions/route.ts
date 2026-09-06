import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveHouseholdId } from "@/lib/auth";
import { householdWhere } from "@/lib/household";
import { findDealsForMissingIngredients } from "@/lib/deals";
import { toPantrySnapshot, toRecipeForMatch } from "@/lib/mappers";
import { parseMoodParam } from "@/lib/moods";
import { suggestMeals } from "@/lib/suggestions";

export async function GET(req: NextRequest) {
  const householdId = await resolveHouseholdId();
  const struggleMode = req.nextUrl.searchParams.get("struggle") === "1";
  const maxMissing = Number(req.nextUrl.searchParams.get("maxMissing") || "2");
  const maxMinutesRaw = req.nextUrl.searchParams.get("maxMinutes");
  const maxMinutesParsed =
    maxMinutesRaw != null && maxMinutesRaw !== ""
      ? Number(maxMinutesRaw)
      : undefined;
  const maxMinutes =
    maxMinutesParsed != null &&
    Number.isFinite(maxMinutesParsed) &&
    maxMinutesParsed > 0
      ? Math.floor(maxMinutesParsed)
      : undefined;
  const includeUnknownTime =
    req.nextUrl.searchParams.get("includeUnknownTime") === "1";
  const mood = parseMoodParam(req.nextUrl.searchParams.get("mood"));
  const qRaw = req.nextUrl.searchParams.get("q");
  const q = qRaw?.trim() ? qRaw.trim() : undefined;

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
    maxMinutes,
    includeUnknownTime,
    mood,
    q,
  }).map((s) => ({
    ...s,
    deals: findDealsForMissingIngredients(s.missingIngredients, coupons),
  }));

  return NextResponse.json({
    struggleMode,
    maxMinutes: maxMinutes ?? null,
    mood: mood ?? "any",
    q: q ?? null,
    pantryCount: pantry.length,
    suggestions,
  });
}
