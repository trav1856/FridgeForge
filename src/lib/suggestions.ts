import { namesMatch } from "./normalize";
import type {
  PantrySnapshot,
  RecipeForMatch,
  SuggestionResult,
} from "./types";

const CHEAP_STAPLES = new Set([
  "rice",
  "beans",
  "eggs",
  "pasta",
  "onion",
  "garlic",
  "potato",
  "flour",
  "oil",
  "salt",
  "pepper",
  "soy",
  "vinegar",
  "lemon",
  "lime",
  "cabbage",
  "carrot",
  "celery",
  "tomato",
  "tuna",
  "peanut",
  "bread",
  "tortilla",
  "chili",
  "sugar",
  "butter",
  "milk",
  "cheese",
]);

const CREATIVE_PAIRINGS: { a: string; b: string; note: string }[] = [
  { a: "peanut", b: "cabbage", note: "Peanut + cabbage: crunchy satay vibes on a budget" },
  { a: "egg", b: "rice", note: "Egg + rice: the classic proud plate — fry an egg, crown the bowl" },
  { a: "tuna", b: "pasta", note: "Tuna + pasta: pantry puttanesca energy without the fancy jar" },
  { a: "potato", b: "egg", note: "Potato + egg: Spanish tortilla / hash destiny" },
  { a: "beans", b: "rice", note: "Beans + rice: complete protein, complete comfort" },
  { a: "soy", b: "egg", note: "Soy + egg: glossy savory magic in 2 minutes" },
  { a: "vinegar", b: "cabbage", note: "Vinegar + cabbage: bright slaw that wakes up any plate" },
  { a: "lemon", b: "pasta", note: "Lemon + pasta: cheap restaurant brightness" },
  { a: "chili", b: "garlic", note: "Chili + garlic: the flavor booster duo" },
  { a: "peanut", b: "soy", note: "Peanut + soy: instant sauce base" },
];

export type SuggestOptions = {
  struggleMode?: boolean;
  maxMissing?: number;
  /** When set, only recipes with known cookTimeMinutes <= maxMinutes (unless includeUnknownTime). */
  maxMinutes?: number;
  /** Include recipes with null/undefined cookTimeMinutes when maxMinutes is set. Default false. */
  includeUnknownTime?: boolean;
};

function findPantryMatch(
  ingredientName: string,
  pantry: PantrySnapshot[]
): PantrySnapshot | undefined {
  return pantry.find((p) => namesMatch(p.name, ingredientName));
}

function isCheapStaple(name: string): boolean {
  return [...CHEAP_STAPLES].some((s) => namesMatch(name, s));
}

function creativeNoteFor(
  matched: string[],
  missing: string[]
): string | undefined {
  const pool = [...matched, ...missing];
  for (const pair of CREATIVE_PAIRINGS) {
    const hasA = pool.some((n) => namesMatch(n, pair.a));
    const hasB = pool.some((n) => namesMatch(n, pair.b));
    if (hasA && hasB) return pair.note;
  }
  return undefined;
}

/** Soft score boost for shorter recipes when the user set a time budget. */
function timeTightnessBoost(
  cookTimeMinutes: number | null | undefined,
  maxMinutes: number | undefined
): number {
  if (maxMinutes == null || cookTimeMinutes == null) return 0;
  if (cookTimeMinutes > maxMinutes) return 0;
  // More leftover time → higher boost (cap ~12). Tight fits still get a little credit.
  const slack = maxMinutes - cookTimeMinutes;
  return Math.min(12, 4 + Math.floor((slack / Math.max(maxMinutes, 1)) * 12));
}

/**
 * Score recipes against pantry.
 * Higher = better suggestion.
 * Prioritizes: can-make-now, few cheap missing staples, affordability, struggle mode.
 */
export function scoreRecipe(
  recipe: RecipeForMatch,
  pantry: PantrySnapshot[],
  options: SuggestOptions = {}
): SuggestionResult {
  const { struggleMode = false, maxMissing = 2, maxMinutes } = options;
  const required = recipe.ingredients.filter((i) => !i.optional);
  const matchedIngredients: string[] = [];
  const missingIngredients: string[] = [];

  for (const ing of required) {
    if (findPantryMatch(ing.name, pantry)) {
      matchedIngredients.push(ing.name);
    } else {
      missingIngredients.push(ing.name);
    }
  }

  // Optional ingredients that we have boost score slightly
  const optionalHits = recipe.ingredients.filter(
    (i) => i.optional && findPantryMatch(i.name, pantry)
  ).length;

  const requiredCount = Math.max(required.length, 1);
  const matchRatio = matchedIngredients.length / requiredCount;
  const missingCount = missingIngredients.length;
  const canMakeNow = missingCount === 0;
  const cheapMissing = missingIngredients.filter(isCheapStaple);
  const nearMiss =
    !canMakeNow &&
    missingCount <= maxMissing &&
    cheapMissing.length === missingCount;

  let score = matchRatio * 100;

  if (canMakeNow) score += 40;
  else if (nearMiss) score += 25 - missingCount * 5;
  else score -= missingCount * 15;

  score += optionalHits * 2;

  const affordabilityBoost =
    recipe.costTier === "cheap" ? 15 : recipe.costTier === "moderate" ? 5 : 0;
  score += affordabilityBoost;

  let struggleBoost = 0;
  if (struggleMode) {
    if (recipe.isStruggleMeal) struggleBoost += 25;
    if (recipe.tags.some((t) => /struggle|budget|staple/i.test(t)))
      struggleBoost += 10;
    if (recipe.costTier === "cheap") struggleBoost += 10;
    // Prefer recipes built on staples the user already has
    const stapleMatches = matchedIngredients.filter(isCheapStaple).length;
    struggleBoost += stapleMatches * 3;
  }
  score += struggleBoost;

  // Slight boost for creative pairings present
  const note = creativeNoteFor(matchedIngredients, missingIngredients);
  if (note) score += 5;

  score += timeTightnessBoost(recipe.cookTimeMinutes, maxMinutes);

  return {
    recipe,
    score,
    matchRatio,
    matchedIngredients,
    missingIngredients,
    missingCount,
    canMakeNow,
    nearMiss,
    affordabilityBoost,
    struggleBoost,
    creativeNote: note,
  };
}

function fitsTimeBudget(
  recipe: RecipeForMatch,
  maxMinutes: number | undefined,
  includeUnknownTime: boolean
): boolean {
  if (maxMinutes == null) return true;
  const t = recipe.cookTimeMinutes;
  if (t == null) return includeUnknownTime;
  return t <= maxMinutes;
}

export function suggestMeals(
  recipes: RecipeForMatch[],
  pantry: PantrySnapshot[],
  options: SuggestOptions = {}
): SuggestionResult[] {
  const {
    struggleMode = false,
    maxMissing = 2,
    maxMinutes,
    includeUnknownTime = false,
  } = options;

  let pool = recipes;
  if (struggleMode) {
    // Prefer struggle meals but don't hide everything else that's cheap
    const struggle = recipes.filter((r) => r.isStruggleMeal || r.costTier === "cheap");
    pool = struggle.length > 0 ? struggle : recipes;
  }

  pool = pool.filter((r) => fitsTimeBudget(r, maxMinutes, includeUnknownTime));

  return pool
    .map((r) =>
      scoreRecipe(r, pantry, { struggleMode, maxMissing, maxMinutes })
    )
    .filter((s) => s.canMakeNow || s.nearMiss || s.matchRatio >= 0.5)
    .sort((a, b) => b.score - a.score);
}

export { CHEAP_STAPLES, CREATIVE_PAIRINGS };
