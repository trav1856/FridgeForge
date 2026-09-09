/**
 * Normalized dish-family slug for grouping recipe variants
 * (e.g. "Grilled Cheese" → "grilled-cheese").
 */

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "with",
  "of",
  "in",
  "on",
  "for",
  "to",
  "from",
  "simple",
  "basic",
  "classic",
  "easy",
  "homemade",
  "best",
  "quick",
]);

/** Explicit staple title → dishKey overrides (shared catalog). */
export const STAPLE_DISH_KEYS: Record<string, string> = {
  "Grilled Cheese": "grilled-cheese",
  "Tomato Basil Grilled Cheese": "grilled-cheese",
  "Classic Apple Pie": "apple-pie",
  "Basic Roast Chicken": "roast-chicken",
  "Chocolate Chip Cookies": "chocolate-chip-cookies",
  "Boiled / Steamed Rice": "steamed-rice",
  "Banana Bread": "banana-bread",
  "Spaghetti with Simple Tomato Sauce": "spaghetti-tomato-sauce",
  "Chili / Taco Filling": "chili-taco-filling",
  "Mashed Potatoes": "mashed-potatoes",
  Pancakes: "pancakes",
  "Scrambled Eggs": "scrambled-eggs",
  "Simple Chicken Soup": "chicken-soup",
  "Veg & Protein Stir-Fry": "stir-fry",
  "Garlic Fried Rice with Crispy Egg": "fried-rice",
  "Smoky Beans & Rice Bowl": "beans-and-rice",
};

export function normalizeDishKey(title: string): string {
  const raw = (title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  if (!raw) return "";
  const parts = raw.split("-").filter((p) => p && !STOP.has(p));
  return (parts.length ? parts : raw.split("-").filter(Boolean)).join("-");
}

/** Prefer explicit staple map, else normalize title. */
export function dishKeyForTitle(title: string): string {
  if (STAPLE_DISH_KEYS[title]) return STAPLE_DISH_KEYS[title];
  return normalizeDishKey(title);
}
