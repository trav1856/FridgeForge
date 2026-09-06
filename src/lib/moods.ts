import type { RecipeForMatch } from "./types";

export type MoodId =
  | "any"
  | "comfort"
  | "fresh"
  | "spicy"
  | "quick"
  | "sweet"
  | "breakfast"
  | "one-pot"
  | "struggle";

export type MoodDef = {
  id: MoodId;
  label: string;
  /** Short hint for accessibility / empty states */
  hint: string;
};

export const MOODS: MoodDef[] = [
  { id: "any", label: "Any", hint: "Clear mood filter" },
  { id: "comfort", label: "Comfort / Cozy", hint: "Soups, stews, cozy classics" },
  { id: "fresh", label: "Fresh / Light", hint: "Bright, citrusy, lighter plates" },
  { id: "spicy", label: "Spicy", hint: "Heat, chili, pepper kick" },
  { id: "quick", label: "Quick & easy", hint: "Fast weeknight energy" },
  { id: "sweet", label: "Something sweet / Dessert", hint: "Baking, cookies, dessert" },
  { id: "breakfast", label: "Breakfast", hint: "Morning and brunch" },
  { id: "one-pot", label: "One-pot / One-bowl", hint: "Minimal dishes" },
  { id: "struggle", label: "Struggle meal vibes", hint: "Budget staple energy" },
];

const MOOD_IDS = new Set<string>(MOODS.map((m) => m.id));

export function isMoodId(value: string | null | undefined): value is MoodId {
  return value != null && MOOD_IDS.has(value);
}

export function parseMoodParam(
  value: string | null | undefined
): MoodId | undefined {
  if (value == null || value === "") return undefined;
  return isMoodId(value) ? value : undefined;
}

function haystack(recipe: RecipeForMatch): string {
  const parts = [
    recipe.title,
    recipe.description ?? "",
    ...recipe.tags,
    ...recipe.flavorBoosters,
  ];
  return parts.join(" ").toLowerCase();
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

function tagMatch(recipe: RecipeForMatch, patterns: RegExp[]): boolean {
  return recipe.tags.some((t) => patterns.some((p) => p.test(t)));
}

/**
 * Whether a recipe fits a mood. `any` always matches.
 * Mood is an additive filter on top of pantry matching — not a replacement.
 */
export function matchesMood(
  recipe: RecipeForMatch,
  mood: MoodId | undefined | null
): boolean {
  if (mood == null || mood === "any") return true;

  const text = haystack(recipe);

  switch (mood) {
    case "comfort":
      return (
        tagMatch(recipe, [/comfort/i, /cozy/i, /soup/i, /stew/i, /casserole/i]) ||
        hasAny(text, [
          "comfort",
          "cozy",
          "soup",
          "stew",
          "mash",
          "grilled cheese",
          "chili",
          "hash",
          "roast",
          "casserole",
        ])
      );

    case "fresh":
      return (
        tagMatch(recipe, [/fresh/i, /light/i, /bright/i, /salad/i, /slaw/i]) ||
        hasAny(text, [
          "fresh",
          "light",
          "bright",
          "lemon",
          "lime",
          "salad",
          "slaw",
          "herb",
          "citrus",
          "cucumber",
        ])
      );

    case "spicy":
      return (
        tagMatch(recipe, [/spicy/i, /chili/i, /hot/i, /pepper/i]) ||
        hasAny(text, [
          "spicy",
          "chili",
          "chilli",
          "hot sauce",
          "cayenne",
          "sriracha",
          "chipotle",
          "jalapeño",
          "jalapeno",
          "pepper flake",
          "chili flake",
          "smoky",
          "heat",
        ])
      );

    case "quick": {
      const tagged =
        tagMatch(recipe, [/quick/i, /easy/i, /15-?min/i, /weeknight/i]) ||
        hasAny(text, ["quick", "easy", "15-min", "15 min", "weeknight"]);
      const timed =
        recipe.cookTimeMinutes != null && recipe.cookTimeMinutes <= 20;
      return tagged || timed;
    }

    case "sweet":
      return (
        tagMatch(recipe, [
          /dessert/i,
          /sweet/i,
          /baking/i,
          /cookie/i,
          /cake/i,
          /pie/i,
        ]) ||
        hasAny(text, [
          "dessert",
          "sweet",
          "cookie",
          "cookies",
          "cake",
          "pie",
          "brownie",
          "banana bread",
          "baking",
          "chocolate",
          "sugar",
        ])
      );

    case "breakfast":
      return (
        tagMatch(recipe, [/breakfast/i, /brunch/i, /pancake/i]) ||
        hasAny(text, [
          "breakfast",
          "brunch",
          "pancake",
          "pancakes",
          "oatmeal",
          "scramble",
          "toast",
          "sunrise",
        ])
      );

    case "one-pot":
      return (
        tagMatch(recipe, [
          /one-?pot/i,
          /one-?bowl/i,
          /skillet/i,
          /sheet-?pan/i,
          /soup/i,
          /stew/i,
          /stir-?fry/i,
        ]) ||
        hasAny(text, [
          "one-pot",
          "one pot",
          "one-bowl",
          "one bowl",
          "skillet",
          "sheet pan",
          "sheet-pan",
          "soup",
          "stew",
          "stir-fry",
          "stir fry",
          "bowl",
        ])
      );

    case "struggle":
      return (
        recipe.isStruggleMeal ||
        recipe.costTier === "cheap" ||
        tagMatch(recipe, [/struggle/i, /budget/i, /staple/i]) ||
        hasAny(text, ["struggle", "budget", "pantry"])
      );

    default:
      return true;
  }
}

/** Soft score boost when the recipe strongly fits the active mood. */
export function moodBoost(
  recipe: RecipeForMatch,
  mood: MoodId | undefined | null
): number {
  if (mood == null || mood === "any") return 0;
  if (!matchesMood(recipe, mood)) return 0;

  let boost = 12;

  // Stronger signals get a little more weight
  if (mood === "struggle" && recipe.isStruggleMeal) boost += 10;
  if (mood === "quick" && recipe.cookTimeMinutes != null) {
    if (recipe.cookTimeMinutes <= 15) boost += 8;
    else if (recipe.cookTimeMinutes <= 20) boost += 4;
  }
  if (
    mood === "sweet" &&
    recipe.tags.some((t) => /dessert/i.test(t))
  ) {
    boost += 6;
  }
  if (
    mood === "breakfast" &&
    recipe.tags.some((t) => /breakfast|brunch/i.test(t))
  ) {
    boost += 6;
  }

  return boost;
}

export type SurpriseCandidate = {
  recipe: { id: string };
  canMakeNow: boolean;
  nearMiss: boolean;
};

/**
 * Pick a surprise recipe from the current filtered set.
 * Prefers canMakeNow, then near-miss, then anything else.
 * Avoids `excludeId` when another option exists.
 */
export function pickSurprise<T extends SurpriseCandidate>(
  suggestions: T[],
  excludeId?: string | null
): T | null {
  if (suggestions.length === 0) return null;

  const preferPool = (pool: T[]) => {
    if (pool.length === 0) return null;
    const withoutLast =
      excludeId != null ? pool.filter((s) => s.recipe.id !== excludeId) : pool;
    const use = withoutLast.length > 0 ? withoutLast : pool;
    return use[Math.floor(Math.random() * use.length)] ?? null;
  };

  return (
    preferPool(suggestions.filter((s) => s.canMakeNow)) ??
    preferPool(suggestions.filter((s) => s.nearMiss)) ??
    preferPool(suggestions)
  );
}
