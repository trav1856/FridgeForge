import type { UnitSystem } from "./units";

export type ConvertedAmount = {
  quantity: number;
  unit: string;
  /** True when qty/unit were left as authored (count units or unknown). */
  unchanged: boolean;
};

const COUNT_UNITS = new Set([
  "each",
  "ea",
  "clove",
  "cloves",
  "can",
  "cans",
  "pinch",
  "pinches",
  "dash",
  "dashes",
  "dozen",
  "pack",
  "package",
  "packages",
  "slice",
  "slices",
  "piece",
  "pieces",
  "bunch",
  "bunches",
  "head",
  "heads",
  "stalk",
  "stalks",
  "sprig",
  "sprigs",
  "leaf",
  "leaves",
  "to taste",
]);

/** Cooking-practical volume → ml. */
const VOLUME_TO_ML: Record<string, number> = {
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  "fl oz": 30,
  floz: 30,
  "fluid ounce": 30,
  "fluid ounces": 30,
  cup: 240,
  cups: 240,
  c: 240,
  pint: 480,
  pints: 480,
  pt: 480,
  quart: 960,
  quarts: 960,
  qt: 960,
  gallon: 3840,
  gallons: 3840,
  gal: 3840,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
};

/** Weight → grams. */
const WEIGHT_TO_G: Record<string, number> = {
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
};

const METRIC_VOLUME = new Set(["ml", "l", "milliliter", "milliliters", "liter", "liters", "litre", "litres", "millilitre", "millilitres"]);
const METRIC_WEIGHT = new Set(["g", "kg", "gram", "grams", "kilogram", "kilograms"]);
const IMPERIAL_VOLUME = new Set([
  "tsp", "teaspoon", "teaspoons",
  "tbsp", "tablespoon", "tablespoons",
  "fl oz", "floz", "fluid ounce", "fluid ounces",
  "cup", "cups", "c",
  "pint", "pints", "pt",
  "quart", "quarts", "qt",
  "gallon", "gallons", "gal",
]);
const IMPERIAL_WEIGHT = new Set(["oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds"]);

function normalizeUnitKey(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/^fluid\s+oz$/, "fl oz")
    .replace(/^fl\.?\s*oz$/, "fl oz");
}

function displayUnit(key: string): string {
  if (key === "l") return "L";
  if (key === "fl oz") return "fl oz";
  return key;
}

/** Round for cooking display: integers when close, else 1 decimal. */
export function roundCooking(n: number): number {
  if (!Number.isFinite(n)) return n;
  if (Math.abs(n) >= 100) return Math.round(n);
  const nearest = Math.round(n);
  if (Math.abs(n - nearest) < 0.05) return nearest;
  const one = Math.round(n * 10) / 10;
  if (Math.abs(n - one) < 0.02) return one;
  return one;
}

function systemOf(key: string): UnitSystem | "count" | "unknown" {
  if (COUNT_UNITS.has(key)) return "count";
  if (METRIC_VOLUME.has(key) || METRIC_WEIGHT.has(key)) return "metric";
  if (IMPERIAL_VOLUME.has(key) || IMPERIAL_WEIGHT.has(key)) return "imperial";
  return "unknown";
}

function mlToMetric(ml: number): ConvertedAmount {
  if (ml >= 1000) {
    return { quantity: roundCooking(ml / 1000), unit: "L", unchanged: false };
  }
  return { quantity: roundCooking(ml), unit: "ml", unchanged: false };
}

function gToMetric(g: number): ConvertedAmount {
  if (g >= 1000) {
    return { quantity: roundCooking(g / 1000), unit: "kg", unchanged: false };
  }
  return { quantity: roundCooking(g), unit: "g", unchanged: false };
}

function mlToImperial(ml: number): ConvertedAmount {
  if (ml >= 3200) {
    return { quantity: roundCooking(ml / 3840), unit: "gallons", unchanged: false };
  }
  if (ml >= 800) {
    return { quantity: roundCooking(ml / 960), unit: "quarts", unchanged: false };
  }
  // Prefer cups for cook-friendly amounts (2 cups = 480 ml, not 1 pint).
  if (ml >= 60) {
    return { quantity: roundCooking(ml / 240), unit: "cups", unchanged: false };
  }
  if (ml >= 22) {
    return { quantity: roundCooking(ml / 30), unit: "fl oz", unchanged: false };
  }
  if (ml >= 12) {
    return { quantity: roundCooking(ml / 15), unit: "tbsp", unchanged: false };
  }
  return { quantity: roundCooking(ml / 5), unit: "tsp", unchanged: false };
}

function gToImperial(g: number): ConvertedAmount {
  if (g >= 400) {
    return { quantity: roundCooking(g / 453.592), unit: "lb", unchanged: false };
  }
  return { quantity: roundCooking(g / 28.35), unit: "oz", unchanged: false };
}

/**
 * Convert a single ingredient quantity+unit toward metric or imperial.
 * Count / unknown units are left unchanged. Already-in-system amounts pass through
 * with light normalization (e.g. "cup" → "cups" not applied — keep authored label).
 */
export function convertIngredient(
  qty: number,
  unit: string,
  to: UnitSystem
): ConvertedAmount {
  const key = normalizeUnitKey(unit || "");
  const sys = systemOf(key);
  if (sys === "count" || sys === "unknown" || !key) {
    return { quantity: qty, unit: unit || "each", unchanged: true };
  }
  if (sys === to) {
    return { quantity: qty, unit: displayUnit(key) === "L" && key === "l" ? "L" : unit, unchanged: true };
  }

  const vol = VOLUME_TO_ML[key];
  if (vol != null) {
    const ml = qty * vol;
    return to === "metric" ? mlToMetric(ml) : mlToImperial(ml);
  }

  const weight = WEIGHT_TO_G[key];
  if (weight != null) {
    const g = qty * weight;
    return to === "metric" ? gToMetric(g) : gToImperial(g);
  }

  return { quantity: qty, unit, unchanged: true };
}

export function convertRecipeIngredients<
  T extends { quantity: number; unit: string },
>(ingredients: T[], to: UnitSystem): (T & ConvertedAmount)[] {
  return ingredients.map((ing) => {
    const converted = convertIngredient(ing.quantity, ing.unit, to);
    return { ...ing, ...converted };
  });
}

/** Format qty for UI (drop trailing .0). */
export function formatQuantity(qty: number): string {
  if (!Number.isFinite(qty)) return String(qty);
  if (Number.isInteger(qty)) return String(qty);
  const t = Math.round(qty * 10) / 10;
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
}
