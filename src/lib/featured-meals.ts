/**
 * Featured meals: Breakfast / Lunch / Dinner picks from the shared catalog
 * (householdId null). Chosen randomly on every page load.
 */

export type MealSlot = "breakfast" | "lunch" | "dinner";

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export type MealClassifiable = {
  id: string;
  title: string;
  tags: string[];
};

const BREAKFAST_TAGS = new Set([
  "breakfast",
  "brunch",
  "pancake",
  "pancakes",
]);
const LUNCH_TAGS = new Set(["lunch", "sandwich", "soup"]);
const DINNER_TAGS = new Set([
  "dinner",
  "supper",
  "roast",
  "chili",
  "stir-fry",
  "one-bowl",
  "weeknight",
]);

const BREAKFAST_TITLE =
  /\b(breakfast|brunch|pancake|scrambled?|hash|oatmeal|granola|toast|waffle)\b/i;
const LUNCH_TITLE =
  /\b(lunch|sandwich|soup|wrap|salad|melt|grilled cheese|tuna)\b/i;
const DINNER_TITLE =
  /\b(dinner|roast|chili|stir[\s-]?fry|bowl|spaghetti|pasta|fried rice|beans?\s*&\s*rice|chicken|taco)\b/i;

/** Classify a recipe into a meal slot via tags, then title heuristics. */
export function classifyMealSlot(recipe: MealClassifiable): MealSlot | null {
  const tags = recipe.tags.map((t) => t.toLowerCase());
  if (tags.some((t) => BREAKFAST_TAGS.has(t))) return "breakfast";
  if (tags.some((t) => LUNCH_TAGS.has(t))) return "lunch";
  if (tags.some((t) => DINNER_TAGS.has(t))) return "dinner";

  const title = recipe.title;
  if (BREAKFAST_TITLE.test(title)) return "breakfast";
  if (LUNCH_TITLE.test(title)) return "lunch";
  if (DINNER_TITLE.test(title)) return "dinner";
  return null;
}

/** Pick a random index in [0, length). Inject rng for tests. */
export function randomIndex(
  length: number,
  rng: () => number = Math.random
): number {
  if (length <= 0) return 0;
  return Math.floor(rng() * length);
}

export type FeaturedPick<T extends MealClassifiable> = {
  slot: MealSlot;
  label: string;
  recipe: T;
};

/**
 * Pick one shared recipe per meal slot at random.
 * Prefers recipes classified for that slot; falls back to other unused shared
 * recipes so cards are never empty when the catalog is non-empty.
 * When the pool allows, the three slots use distinct recipes.
 */
export function pickFeaturedMeals<T extends MealClassifiable>(
  recipes: T[],
  rng: () => number = Math.random
): FeaturedPick<T>[] {
  if (recipes.length === 0) return [];

  const bySlot: Record<MealSlot, T[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
  };
  const unclassified: T[] = [];

  for (const r of recipes) {
    const slot = classifyMealSlot(r);
    if (slot) bySlot[slot].push(r);
    else unclassified.push(r);
  }

  const used = new Set<string>();
  const picks: FeaturedPick<T>[] = [];

  for (const slot of MEAL_SLOTS) {
    const pool = bySlot[slot].filter((r) => !used.has(r.id));
    let chosen: T | undefined;

    if (pool.length > 0) {
      chosen = pool[randomIndex(pool.length, rng)]!;
    } else {
      const fallback = [
        ...unclassified,
        ...MEAL_SLOTS.filter((s) => s !== slot).flatMap((s) => bySlot[s]),
      ].filter((r) => !used.has(r.id));
      if (fallback.length > 0) {
        chosen = fallback[randomIndex(fallback.length, rng)]!;
      } else if (recipes.length > 0) {
        chosen = recipes[randomIndex(recipes.length, rng)]!;
      }
    }

    if (chosen) {
      used.add(chosen.id);
      picks.push({
        slot,
        label: MEAL_SLOT_LABEL[slot],
        recipe: chosen,
      });
    }
  }

  return picks;
}

/** @deprecated Prefer pickFeaturedMeals */
export const pickRecipeOfTheWeek = pickFeaturedMeals;

/** @deprecated ISO week no longer drives featured picks. */
export function isoWeekKey(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** @deprecated Hash seed unused for random featured picks. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
