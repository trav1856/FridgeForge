import type { PantryCategory } from "./categories";

/** Shared with recipe display toggle / future cook view. */
export type UnitSystem = "imperial" | "metric";

export const UNIT_SYSTEM_STORAGE_KEY = "ff_unit_system";

export type MeasureKind =
  | "liquid"
  | "solid_weight"
  | "count"
  | "volume_dry"
  | "spice"
  | "semi_solid"
  | "oil"
  | "canned"
  | "produce";

/** Ordered unit presets by substance kind (imperial-first, then metric). */
export const UNITS_BY_KIND: Record<MeasureKind, readonly string[]> = {
  liquid: ["fl oz", "cups", "pints", "quarts", "gallons", "ml", "L"],
  oil: ["fl oz", "cups", "tbsp", "ml", "L"],
  solid_weight: ["oz", "lb", "g", "kg"],
  count: ["each", "dozen", "pack"],
  volume_dry: ["cups", "oz", "lb", "g", "kg"],
  spice: ["tsp", "tbsp", "oz", "g"],
  /** Yogurt / sour cream — volume + tub weight. */
  semi_solid: ["fl oz", "cups", "oz", "g", "lb"],
  canned: ["cans", "oz", "fl oz", "ml"],
  produce: ["each", "lb", "oz", "g"],
};

/** Cheese / cream cheese / butter — weight only (no gallons). */
const CHEESE_UNITS = ["oz", "lb", "g"] as const;

const LIQUID_NAME =
  /\b(milk|cream|half.?and.?half|buttermilk|broth|stock|juice|water|soda|beverage)\b/i;
const OIL_NAME =
  /\b(oil|vinegar|soy.?sauce|fish.?sauce|worcestershire|ketchup|mustard|mayo|mayonnaise|hot.?sauce|syrup|honey|dressing|sauce)\b/i;
const CHEESE_NAME =
  /\b(mozzarella|cheddar|parmesan|swiss|provolone|feta|gouda|cheese|cream.?cheese|butter)\b/i;
const YOGURT_NAME = /\b(yogurt|yoghurt|sour.?cream|ricotta|cottage.?cheese)\b/i;
const COUNT_NAME =
  /\b(eggs?|tortillas?|bread|buns?|rolls?|cloves?|bay.?leaves?)\b/i;
const PASTA_GRAIN =
  /\b(spaghetti|penne|pasta|noodles?|rice|oats?|cornmeal|breadcrumbs?|beans?.?\(dry\)|lentils?|quinoa)\b/i;
const BAKING_DRY =
  /\b(flour|sugar|brown.?sugar|powdered.?sugar|cocoa|cornstarch|chocolate.?chips?|yeast)\b/i;
const SPICE_NAME =
  /\b(salt|pepper|paprika|cumin|oregano|cinnamon|chili|garlic.?powder|onion.?powder|spice|seasoning|extract)\b/i;
const PRODUCE_NAME =
  /\b(onion|garlic|potato|carrot|celery|pepper|tomato|broccoli|spinach|lettuce|cabbage|zucchini|cucumber|mushroom|apple|banana|orange|lemon|lime|grape|berr|strawberr|avocado)\b/i;
const MEAT_NAME =
  /\b(beef|chicken|turkey|pork|bacon|tofu|meat|thigh|breast|chop|steak|sausage|ham)\b/i;

export function inferMeasureKind(
  name: string,
  category?: PantryCategory | string | null,
  explicit?: MeasureKind | null
): MeasureKind {
  if (explicit) return explicit;

  const n = name.trim();
  if (!n && category) return measureKindForCategory(category);

  if (COUNT_NAME.test(n)) return "count";
  if (YOGURT_NAME.test(n)) return "semi_solid";
  if (CHEESE_NAME.test(n)) return "semi_solid";
  if (LIQUID_NAME.test(n)) return "liquid";
  if (OIL_NAME.test(n)) return "oil";
  if (SPICE_NAME.test(n)) return "spice";
  if (BAKING_DRY.test(n)) return "volume_dry";
  if (PASTA_GRAIN.test(n)) return "solid_weight";
  if (MEAT_NAME.test(n)) return "solid_weight";
  if (PRODUCE_NAME.test(n)) return "produce";
  if (/\bcanned\b|\bcan of\b/i.test(n)) return "canned";

  return measureKindForCategory(category);
}

export function measureKindForCategory(
  category?: PantryCategory | string | null
): MeasureKind {
  switch (category) {
    case "Proteins":
      return "solid_weight";
    case "Produce":
      return "produce";
    case "Grains":
      return "solid_weight";
    case "Dairy":
      return "semi_solid";
    case "Canned":
      return "canned";
    case "Baking":
      return "volume_dry";
    case "Spices":
      return "spice";
    case "Oils & Condiments":
      return "oil";
    default:
      return "count";
  }
}

/**
 * Ordered unit strings for a pantry select.
 * Cheese-like semi-solids get weight-only options; yogurt keeps volume + weight.
 */
export function unitsForItem(
  name: string,
  category?: PantryCategory | string | null,
  measureKind?: MeasureKind | null
): string[] {
  const kind = inferMeasureKind(name, category, measureKind);
  if (kind === "semi_solid" && CHEESE_NAME.test(name) && !YOGURT_NAME.test(name)) {
    return [...CHEESE_UNITS];
  }
  return [...UNITS_BY_KIND[kind]];
}

/** Prefer suggestedUnit when it appears in the substance list; else first option. */
export function defaultUnitForItem(
  name: string,
  category?: PantryCategory | string | null,
  suggestedUnit?: string | null,
  measureKind?: MeasureKind | null
): string {
  const units = unitsForItem(name, category, measureKind);
  if (suggestedUnit && units.includes(suggestedUnit)) return suggestedUnit;
  return units[0] ?? "each";
}

export function readStoredUnitSystem(
  fallback: UnitSystem = "imperial"
): UnitSystem {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(UNIT_SYSTEM_STORAGE_KEY);
    if (v === "metric" || v === "imperial") return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function storeUnitSystem(system: UnitSystem): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UNIT_SYSTEM_STORAGE_KEY, system);
  } catch {
    /* ignore */
  }
}
