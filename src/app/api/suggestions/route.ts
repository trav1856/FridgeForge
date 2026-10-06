import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { resolveDietarySuggestOptions } from "@/lib/dietary";
import { householdWhere, recipeScopeWhere } from "@/lib/household";
import { parseGuestPantry } from "@/lib/guest-pantry";
import { sampleCouponsForMatching } from "@/lib/sample-coupons";
import type { PantrySnapshot } from "@/lib/types";
import { findDealsForMissingIngredients } from "@/lib/deals";
import { toPantrySnapshot, toRecipeForMatch } from "@/lib/mappers";
import { collectAvailableTags, parseMoodParam } from "@/lib/moods";
import { suggestMeals } from "@/lib/suggestions";
import { dedupeRecipesByTitle } from "@/lib/dedupe-recipes";
import {
  getReviewStatsByRecipeIds,
  reviewStatsFor,
} from "@/lib/recipe-review-stats";

/** GET: signed-in households (server pantry). Guests without a body get an empty pantry. */
export async function GET(req: NextRequest) {
  return suggest(req, undefined);
}

/**
 * POST { pantry }: read-only calculation for guests using their browser-local
 * demo pantry. Nothing is written. Signed-in households ignore the body and
 * use their own server pantry.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { pantry?: unknown } | null;
  return suggest(req, body?.pantry);
}

async function suggest(req: NextRequest, guestPantryRaw: unknown) {
  const householdId = await resolveHouseholdId();
  const user = await getCurrentUser();
  const dietary = resolveDietarySuggestOptions(user);
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

  // Recipes: shared catalog + household. Pantry + coupons: the household's own;
  // guests use their posted demo pantry and the static sample coupons.
  const [pantryItems, recipes, dbCoupons] = await Promise.all([
    householdId
      ? prisma.pantryItem.findMany({ where: householdWhere(householdId) })
      : Promise.resolve([]),
    prisma.recipe.findMany({
      where: recipeScopeWhere(householdId),
      include: { ingredients: true },
    }),
    householdId
      ? prisma.coupon.findMany({ where: householdWhere(householdId) })
      : Promise.resolve([]),
  ]);

  const pantry: PantrySnapshot[] = householdId
    ? pantryItems.map(toPantrySnapshot)
    : parseGuestPantry(guestPantryRaw);
  const coupons = householdId ? dbCoupons : sampleCouponsForMatching();
  const recipeData = dedupeRecipesByTitle(recipes, householdId).map(toRecipeForMatch);
  const ranked = suggestMeals(recipeData, pantry, {
    struggleMode,
    maxMissing: Number.isFinite(maxMissing) ? maxMissing : 2,
    maxMinutes,
    includeUnknownTime,
    mood,
    q,
    ...dietary,
  });

  // Display-only averages — do not affect Cook Now ranking / soft-boost.
  const reviewStats = await getReviewStatsByRecipeIds(
    ranked.map((s) => s.recipe.id)
  );
  const suggestions = ranked.map((s) => {
    const stats = reviewStatsFor(reviewStats, s.recipe.id);
    return {
      ...s,
      recipe: {
        ...s.recipe,
        averageStars: stats.averageStars,
        reviewCount: stats.reviewCount,
      },
      deals: findDealsForMissingIngredients(s.missingIngredients, coupons),
    };
  });

  const availableTags = collectAvailableTags(recipeData);

  return NextResponse.json({
    struggleMode,
    dietary,
    maxMinutes: maxMinutes ?? null,
    mood: mood ?? "any",
    q: q ?? null,
    pantryCount: pantry.length,
    demoPantry: !householdId,
    availableTags,
    suggestions,
  });
}
