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
  | "struggle"
  | "mexican"
  | "chinese"
  | "italian"
  | "indian"
  | "american"
  | "noodles"
  | "potato"
  | "seafood"
  | "vegetarian"
  | "soup"
  | "bbq";

/** Curated mood ids plus any recipe-tag slug used as a dynamic mood filter. */
export type MoodParam = MoodId | string;

export type MoodDef = {
  id: string;
  label: string;
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
  { id: "mexican", label: "Mexican", hint: "Tacos, salsa, chili vibes" },
  { id: "chinese", label: "Chinese", hint: "Stir-fry, soy, noodles" },
  { id: "italian", label: "Italian", hint: "Pasta, tomato, garlic" },
  { id: "indian", label: "Indian", hint: "Curry, spices, dal" },
  { id: "american", label: "American", hint: "Burgers, BBQ, diner classics" },
  { id: "noodles", label: "Noodles", hint: "Pasta, ramen, lo mein" },
  { id: "potato", label: "Potato", hint: "Hash, mash, fries" },
  { id: "seafood", label: "Seafood", hint: "Fish, tuna, shrimp" },
  { id: "vegetarian", label: "Vegetarian", hint: "Veg-forward plates" },
  { id: "soup", label: "Soup", hint: "Brothy bowls and stews" },
  { id: "bbq", label: "BBQ", hint: "Smoke, grill, sauce" },
];

const MOOD_IDS = new Set<string>(MOODS.map((m) => m.id));

const MAX_TAG_MOOD_LEN = 64;

export function isMoodId(value: string | null | undefined): value is MoodId {
  return value != null && MOOD_IDS.has(value);
}

/**
 * Accept curated mood ids, or any non-empty tag slug (for dynamic mood chips).
 * Returns undefined for empty / oversized junk.
 */
export function parseMoodParam(
  value: string | null | undefined
): MoodParam | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (isMoodId(trimmed)) return trimmed;
  if (trimmed.length > MAX_TAG_MOOD_LEN) return undefined;
  // Normalize dynamic tag moods to lowercase slugs for stable filtering
  return trimmed.toLowerCase();
}

/** Distinct recipe tags (case-insensitive), sorted, first-seen casing preserved. */
export function collectAvailableTags(
  recipes: { tags: string[] }[]
): string[] {
  const seen = new Map<string, string>();
  for (const recipe of recipes) {
    for (const raw of recipe.tags) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, display]) => display);
}

function formatTagLabel(tag: string): string {
  if (!tag) return tag;
  // Keep short all-caps (BBQ-style) as-is; otherwise title-case words
  if (tag === tag.toUpperCase() && tag.length <= 4) return tag;
  return tag
    .split(/([\s_-]+)/)
    .map((part) => {
      if (/^[\s_-]+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

/**
 * Curated MOODS plus dynamic chips from recipe tags.
 * Dedupes when a tag slug already matches a curated mood id.
 */
export function buildMoodChips(availableTags: string[]): MoodDef[] {
  const curatedLower = new Set(MOODS.map((m) => m.id.toLowerCase()));
  const extras: MoodDef[] = [];
  for (const tag of availableTags) {
    const slug = tag.trim();
    if (!slug) continue;
    const key = slug.toLowerCase();
    if (curatedLower.has(key)) continue;
    extras.push({
      id: key,
      label: formatTagLabel(slug),
      hint: `Recipes tagged “${slug}”`,
    });
  }
  return [...MOODS, ...extras];
}

function haystack(recipe: RecipeForMatch): string {
  const parts = [
    recipe.title,
    recipe.description ?? "",
    ...recipe.tags,
    ...recipe.flavorBoosters,
    ...recipe.ingredients.map((i) => i.name),
  ];
  return parts.join(" ").toLowerCase();
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

function tagMatch(recipe: RecipeForMatch, patterns: RegExp[]): boolean {
  return recipe.tags.some((t) => patterns.some((p) => p.test(t)));
}

/** Exact tag match (case-insensitive) for dynamic mood chips. */
export function recipeHasTag(
  recipe: { tags: string[] },
  tag: string
): boolean {
  const needle = tag.trim().toLowerCase();
  if (!needle) return false;
  return recipe.tags.some((t) => t.trim().toLowerCase() === needle);
}

/** Free-text craving search across title, tags, and ingredient names. */
export function matchesQuery(
  recipe: RecipeForMatch,
  q: string | undefined | null
): boolean {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return true;
  const text = haystack(recipe);
  if (text.includes(needle)) return true;
  const tokens = needle.split(/\s+/).filter(Boolean);
  return tokens.every((t) => text.includes(t));
}

export function matchesMood(
  recipe: RecipeForMatch,
  mood: MoodParam | undefined | null
): boolean {
  if (mood == null || mood === "any") return true;
  const text = haystack(recipe);

  switch (mood) {
    case "comfort":
      return (
        tagMatch(recipe, [/comfort/i, /cozy/i, /soup/i, /stew/i, /casserole/i]) ||
        hasAny(text, ["comfort", "cozy", "soup", "stew", "mash", "grilled cheese", "chili", "hash", "roast", "casserole"])
      );
    case "fresh":
      return (
        tagMatch(recipe, [/fresh/i, /light/i, /bright/i, /salad/i, /slaw/i]) ||
        hasAny(text, ["fresh", "light", "bright", "lemon", "lime", "salad", "slaw", "herb", "citrus", "cucumber"])
      );
    case "spicy":
      return (
        tagMatch(recipe, [/spicy/i, /chili/i, /hot/i, /pepper/i]) ||
        hasAny(text, ["spicy", "chili", "chilli", "hot sauce", "cayenne", "sriracha", "chipotle", "jalapeño", "jalapeno", "pepper flake", "chili flake", "smoky", "heat"])
      );
    case "quick": {
      const tagged =
        tagMatch(recipe, [/quick/i, /easy/i, /15-?min/i, /weeknight/i]) ||
        hasAny(text, ["quick", "easy", "15-min", "15 min", "weeknight"]);
      const timed = recipe.cookTimeMinutes != null && recipe.cookTimeMinutes <= 20;
      return tagged || timed;
    }
    case "sweet":
      return (
        tagMatch(recipe, [/dessert/i, /sweet/i, /baking/i, /cookie/i, /cake/i, /pie/i]) ||
        hasAny(text, ["dessert", "sweet", "cookie", "cookies", "cake", "pie", "brownie", "banana bread", "baking", "chocolate", "sugar"])
      );
    case "breakfast":
      return (
        tagMatch(recipe, [/breakfast/i, /brunch/i, /pancake/i]) ||
        hasAny(text, ["breakfast", "brunch", "pancake", "pancakes", "oatmeal", "scramble", "toast", "sunrise"])
      );
    case "one-pot":
      return (
        tagMatch(recipe, [/one-?pot/i, /one-?bowl/i, /skillet/i, /sheet-?pan/i, /soup/i, /stew/i, /stir-?fry/i]) ||
        hasAny(text, ["one-pot", "one pot", "one-bowl", "one bowl", "skillet", "sheet pan", "sheet-pan", "soup", "stew", "stir-fry", "stir fry", "bowl"])
      );
    case "struggle":
      return (
        recipe.isStruggleMeal ||
        recipe.costTier === "cheap" ||
        tagMatch(recipe, [/struggle/i, /budget/i, /staple/i]) ||
        hasAny(text, ["struggle", "budget", "pantry"])
      );
    case "mexican":
      return (
        tagMatch(recipe, [/mexican/i, /taco/i, /chili/i]) ||
        hasAny(text, ["mexican", "taco", "burrito", "salsa", "enchilada", "tortilla", "cumin", "chipotle"])
      );
    case "chinese":
      return (
        tagMatch(recipe, [/chinese/i, /stir-?fry/i, /asian/i]) ||
        hasAny(text, ["chinese", "stir-fry", "stir fry", "soy sauce", "lo mein", "fried rice", "wok", "sesame"])
      );
    case "italian":
      return (
        tagMatch(recipe, [/italian/i, /pasta/i, /pizza/i]) ||
        hasAny(text, ["italian", "pasta", "spaghetti", "pizza", "marinara", "parmesan", "oregano", "tomato sauce"])
      );
    case "indian":
      return (
        tagMatch(recipe, [/indian/i, /curry/i, /masala/i]) ||
        hasAny(text, ["indian", "curry", "masala", "tikka", "dal", "garam", "naan", "biryani"])
      );
    case "american":
      return (
        tagMatch(recipe, [/american/i, /bbq/i, /burger/i, /diner/i]) ||
        hasAny(text, ["american", "burger", "bbq", "barbecue", "grilled cheese", "mac and cheese", "diner", "hash", "pancake", "apple pie", "roast chicken"])
      );
    case "noodles":
      return (
        tagMatch(recipe, [/noodle/i, /pasta/i, /ramen/i]) ||
        hasAny(text, ["noodle", "noodles", "pasta", "spaghetti", "ramen", "lo mein", "udon", "macaroni"])
      );
    case "potato":
      return tagMatch(recipe, [/potato/i]) || hasAny(text, ["potato", "potatoes", "mash", "hash", "fries"]);
    case "seafood":
      return (
        tagMatch(recipe, [/seafood/i, /fish/i, /tuna/i]) ||
        hasAny(text, ["seafood", "fish", "tuna", "salmon", "shrimp", "cod", "crab"])
      );
    case "vegetarian":
      return (
        tagMatch(recipe, [/vegetarian/i, /vegan/i, /veggie/i]) ||
        hasAny(text, ["vegetarian", "vegan", "veggie", "plant-based"]) ||
        (!hasAny(text, ["chicken", "beef", "pork", "fish", "tuna", "shrimp", "bacon", "sausage", "meat"]) &&
          (tagMatch(recipe, [/vegetable/i, /salad/i, /soup/i]) ||
            hasAny(text, ["cabbage", "carrot", "bean", "tofu", "lentil"])))
      );
    case "soup":
      return (
        tagMatch(recipe, [/soup/i, /stew/i, /broth/i]) ||
        hasAny(text, ["soup", "stew", "broth", "chowder", "bisque"])
      );
    case "bbq":
      return (
        tagMatch(recipe, [/bbq/i, /barbecue/i, /grill/i, /smoky/i]) ||
        hasAny(text, ["bbq", "barbecue", "grill", "smoky", "smoke"])
      );
    default:
      // Dynamic tag mood: must have this exact tag (case-insensitive)
      return recipeHasTag(recipe, mood);
  }
}

export function moodBoost(
  recipe: RecipeForMatch,
  mood: MoodParam | undefined | null
): number {
  if (mood == null || mood === "any") return 0;
  if (!matchesMood(recipe, mood)) return 0;
  let boost = 12;
  if (mood === "struggle" && recipe.isStruggleMeal) boost += 10;
  if (mood === "quick" && recipe.cookTimeMinutes != null) {
    if (recipe.cookTimeMinutes <= 15) boost += 8;
    else if (recipe.cookTimeMinutes <= 20) boost += 4;
  }
  if (mood === "sweet" && recipe.tags.some((t) => /dessert/i.test(t))) boost += 6;
  if (mood === "breakfast" && recipe.tags.some((t) => /breakfast|brunch/i.test(t))) boost += 6;
  if ((mood === "noodles" || mood === "potato" || mood === "soup") && matchesMood(recipe, mood)) boost += 4;
  // Extra nudge when the mood is a dynamic tag that appears on the recipe
  if (!isMoodId(mood) && recipeHasTag(recipe, mood)) boost += 4;
  return boost;
}

export type SurpriseCandidate = {
  recipe: { id: string };
  canMakeNow: boolean;
  nearMiss: boolean;
};

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
