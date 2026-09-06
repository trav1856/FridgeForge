import { namesMatch, normalizeName } from "./normalize";
import { parseNutritionJson, type NutritionSnapshot } from "./open-food-facts";

/** Macros per 100g (or scaled from unit defaults via grams helpers). */
export type Macros = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  /** milligrams */
  sodium?: number;
};

export type NutritionTableEntry = Macros & {
  /** Approximate grams when measured by cup (volume → mass heuristic). */
  gPerCup?: number;
  /** Grams per tablespoon when volume. */
  gPerTbsp?: number;
  /** Grams per teaspoon when volume. */
  gPerTsp?: number;
  /** Grams for one "each" / piece / clove / egg / etc. */
  gPerEach?: number;
  /** Extra match phrases beyond the table key. */
  aliases?: string[];
};

/**
 * Common pantry staples — USDA-ish round numbers per 100g.
 * Values are estimates for home cooking, not lab precision.
 */
export const NUTRITION_TABLE: Record<string, NutritionTableEntry> = {
  rice: {
    kcal: 130,
    protein: 2.7,
    fat: 0.3,
    carbs: 28,
    fiber: 0.4,
    sodium: 1,
    gPerCup: 185, // cooked-ish / leftover rice volume
    aliases: ["white rice", "brown rice", "jasmine rice", "cooked rice"],
  },
  "brown rice": {
    kcal: 112,
    protein: 2.3,
    fat: 0.8,
    carbs: 24,
    fiber: 1.8,
    gPerCup: 195,
  },
  pasta: {
    kcal: 131,
    protein: 5,
    fat: 1.1,
    carbs: 25,
    fiber: 1.8,
    gPerCup: 140, // cooked
    aliases: ["spaghetti", "noodles", "macaroni", "penne"],
  },
  flour: {
    kcal: 364,
    protein: 10,
    fat: 1,
    carbs: 76,
    fiber: 2.7,
    gPerCup: 120,
    aliases: ["all purpose flour", "ap flour", "wheat flour"],
  },
  sugar: {
    kcal: 387,
    protein: 0,
    fat: 0,
    carbs: 100,
    gPerCup: 200,
    gPerTbsp: 12.5,
    gPerTsp: 4,
    aliases: ["white sugar", "granulated sugar"],
  },
  "brown sugar": {
    kcal: 380,
    protein: 0,
    fat: 0,
    carbs: 98,
    gPerCup: 220,
    gPerTbsp: 14,
  },
  butter: {
    kcal: 717,
    protein: 0.9,
    fat: 81,
    carbs: 0.1,
    sodium: 643,
    gPerCup: 227,
    gPerTbsp: 14,
    gPerTsp: 5,
  },
  oil: {
    kcal: 884,
    protein: 0,
    fat: 100,
    carbs: 0,
    gPerCup: 218,
    gPerTbsp: 14,
    gPerTsp: 4.5,
    aliases: ["vegetable oil", "cooking oil", "canola oil", "olive oil", "neutral oil"],
  },
  "olive oil": {
    kcal: 884,
    protein: 0,
    fat: 100,
    carbs: 0,
    gPerCup: 216,
    gPerTbsp: 13.5,
    gPerTsp: 4.5,
  },
  egg: {
    kcal: 143,
    protein: 13,
    fat: 10,
    carbs: 0.7,
    sodium: 142,
    gPerEach: 50,
    aliases: ["eggs", "large eggs", "chicken eggs"],
  },
  milk: {
    kcal: 61,
    protein: 3.2,
    fat: 3.3,
    carbs: 4.8,
    sodium: 44,
    gPerCup: 244,
    aliases: ["whole milk", "2% milk", "skim milk"],
  },
  cheese: {
    kcal: 402,
    protein: 25,
    fat: 33,
    carbs: 1.3,
    sodium: 621,
    gPerCup: 113, // shredded
    gPerEach: 28, // ~1 oz slice
    aliases: ["cheddar", "shredded cheese", "parmesan", "mozzarella"],
  },
  chicken: {
    kcal: 165,
    protein: 31,
    fat: 3.6,
    carbs: 0,
    sodium: 74,
    gPerCup: 140,
    aliases: ["chicken breast", "chicken thighs", "cooked chicken"],
  },
  beef: {
    kcal: 250,
    protein: 26,
    fat: 15,
    carbs: 0,
    sodium: 72,
    aliases: ["ground beef", "beef mince", "steak"],
  },
  pork: {
    kcal: 242,
    protein: 27,
    fat: 14,
    carbs: 0,
    aliases: ["pork chop", "ground pork"],
  },
  tuna: {
    kcal: 116,
    protein: 26,
    fat: 0.8,
    carbs: 0,
    sodium: 247,
    gPerEach: 140, // typical can drained-ish
    aliases: ["canned tuna", "tuna fish"],
  },
  beans: {
    kcal: 127,
    protein: 8.7,
    fat: 0.5,
    carbs: 23,
    fiber: 6.4,
    sodium: 238,
    gPerCup: 170,
    gPerEach: 425, // can
    aliases: ["black beans", "pinto beans", "kidney beans", "canned beans"],
  },
  "peanut butter": {
    kcal: 588,
    protein: 25,
    fat: 50,
    carbs: 20,
    fiber: 6,
    sodium: 459,
    gPerCup: 258,
    gPerTbsp: 16,
    gPerTsp: 5,
    aliases: ["pb"],
  },
  onion: {
    kcal: 40,
    protein: 1.1,
    fat: 0.1,
    carbs: 9.3,
    fiber: 1.7,
    gPerEach: 110,
    gPerCup: 160,
    aliases: ["onions", "yellow onion", "white onion", "red onion"],
  },
  garlic: {
    kcal: 149,
    protein: 6.4,
    fat: 0.5,
    carbs: 33,
    fiber: 2.1,
    gPerEach: 3, // clove
    gPerCup: 136,
    aliases: ["garlic cloves", "garlic clove", "minced garlic"],
  },
  potato: {
    kcal: 77,
    protein: 2,
    fat: 0.1,
    carbs: 17,
    fiber: 2.2,
    gPerEach: 173,
    gPerCup: 150,
    aliases: ["potatoes", "russet potato"],
  },
  carrot: {
    kcal: 41,
    protein: 0.9,
    fat: 0.2,
    carbs: 10,
    fiber: 2.8,
    gPerEach: 61,
    gPerCup: 128,
    aliases: ["carrots"],
  },
  cabbage: {
    kcal: 25,
    protein: 1.3,
    fat: 0.1,
    carbs: 6,
    fiber: 2.5,
    gPerCup: 90,
    gPerEach: 900, // head — rough
    aliases: ["green cabbage", "shredded cabbage"],
  },
  tomato: {
    kcal: 18,
    protein: 0.9,
    fat: 0.2,
    carbs: 3.9,
    fiber: 1.2,
    gPerEach: 123,
    gPerCup: 180,
    aliases: ["tomatoes", "canned tomatoes", "diced tomatoes"],
  },
  "soy sauce": {
    kcal: 53,
    protein: 8.1,
    fat: 0.1,
    carbs: 4.9,
    sodium: 5493,
    gPerCup: 255,
    gPerTbsp: 16,
    gPerTsp: 5,
    aliases: ["soy", "tamari"],
  },
  vinegar: {
    kcal: 18,
    protein: 0,
    fat: 0,
    carbs: 0.04,
    gPerCup: 240,
    gPerTbsp: 15,
    gPerTsp: 5,
    aliases: ["white vinegar", "apple cider vinegar", "rice vinegar"],
  },
  bread: {
    kcal: 265,
    protein: 9,
    fat: 3.2,
    carbs: 49,
    fiber: 2.7,
    sodium: 491,
    gPerEach: 28, // slice
    aliases: ["sandwich bread", "toast"],
  },
  tortilla: {
    kcal: 312,
    protein: 8,
    fat: 7,
    carbs: 52,
    gPerEach: 45,
    aliases: ["tortillas", "flour tortilla", "corn tortilla"],
  },
  oats: {
    kcal: 389,
    protein: 17,
    fat: 7,
    carbs: 66,
    fiber: 10.6,
    gPerCup: 80,
  },
  yogurt: {
    kcal: 61,
    protein: 3.5,
    fat: 3.3,
    carbs: 4.7,
    gPerCup: 245,
  },
  bacon: {
    kcal: 541,
    protein: 37,
    fat: 42,
    carbs: 1.4,
    sodium: 1717,
    gPerEach: 8, // strip
  },
  tofu: {
    kcal: 76,
    protein: 8,
    fat: 4.8,
    carbs: 1.9,
    gPerCup: 126,
  },
  celery: {
    kcal: 16,
    protein: 0.7,
    fat: 0.2,
    carbs: 3,
    fiber: 1.6,
    gPerEach: 40, // stalk
    gPerCup: 101,
  },
  pepper: {
    // black pepper — tiny amounts
    kcal: 251,
    protein: 10,
    fat: 3.3,
    carbs: 64,
    fiber: 25,
    gPerTsp: 2.3,
    gPerTbsp: 6.9,
    aliases: ["black pepper", "ground pepper"],
  },
  salt: {
    kcal: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    sodium: 38758,
    gPerTsp: 6,
    gPerTbsp: 18,
    aliases: ["kosher salt", "sea salt", "table salt"],
  },
  "chili flakes": {
    kcal: 282,
    protein: 12,
    fat: 14,
    carbs: 50,
    fiber: 27,
    gPerTsp: 1.8,
    gPerTbsp: 5.4,
    aliases: ["red pepper flakes", "crushed red pepper", "chili"],
  },
  lemon: {
    kcal: 29,
    protein: 1.1,
    fat: 0.3,
    carbs: 9,
    fiber: 2.8,
    gPerEach: 58,
    gPerCup: 244, // juice
    aliases: ["lemon juice", "lemons"],
  },
  lime: {
    kcal: 30,
    protein: 0.7,
    fat: 0.2,
    carbs: 11,
    gPerEach: 67,
    gPerCup: 242,
    aliases: ["lime juice", "limes"],
  },
  honey: {
    kcal: 304,
    protein: 0.3,
    fat: 0,
    carbs: 82,
    gPerCup: 339,
    gPerTbsp: 21,
    gPerTsp: 7,
  },
  cornstarch: {
    kcal: 381,
    protein: 0.3,
    fat: 0.1,
    carbs: 91,
    gPerCup: 128,
    gPerTbsp: 8,
  },
  water: {
    kcal: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    gPerCup: 240,
    gPerTbsp: 15,
  },
  broth: {
    kcal: 7,
    protein: 0.6,
    fat: 0.2,
    carbs: 0.5,
    sodium: 340,
    gPerCup: 240,
    aliases: ["stock", "chicken broth", "vegetable broth"],
  },
};

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
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
};

const COUNT_UNITS = new Set([
  "each",
  "ea",
  "clove",
  "cloves",
  "can",
  "cans",
  "slice",
  "slices",
  "piece",
  "pieces",
  "egg",
  "eggs",
  "head",
  "heads",
  "stalk",
  "stalks",
  "strip",
  "strips",
  "",
]);

function normalizeUnitKey(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/^fluid\s+oz$/, "fl oz")
    .replace(/^fl\.?\s*oz$/, "fl oz");
}

function emptyMacros(): Required<Macros> {
  return { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sodium: 0 };
}

function addMacros(a: Required<Macros>, b: Macros, scale: number): void {
  a.kcal += (b.kcal ?? 0) * scale;
  a.protein += (b.protein ?? 0) * scale;
  a.fat += (b.fat ?? 0) * scale;
  a.carbs += (b.carbs ?? 0) * scale;
  a.fiber += (b.fiber ?? 0) * scale;
  a.sodium += (b.sodium ?? 0) * scale;
}

function roundMacro(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) < 0.5) return Math.round(n * 10) / 10;
  return Math.round(n);
}

function roundMacros(m: Required<Macros>): Macros {
  const out: Macros = {
    kcal: roundMacro(m.kcal),
    protein: roundMacro(m.protein),
    fat: roundMacro(m.fat),
    carbs: roundMacro(m.carbs),
  };
  if (m.fiber > 0.4) out.fiber = roundMacro(m.fiber);
  if (m.sodium > 0.5) out.sodium = roundMacro(m.sodium);
  return out;
}

function macrosFromSnapshot(snap: NutritionSnapshot): Macros | null {
  if (
    snap.caloriesPer100g == null &&
    snap.proteinPer100g == null &&
    snap.fatPer100g == null &&
    snap.carbsPer100g == null
  ) {
    return null;
  }
  return {
    kcal: snap.caloriesPer100g ?? 0,
    protein: snap.proteinPer100g ?? 0,
    fat: snap.fatPer100g ?? 0,
    carbs: snap.carbsPer100g ?? 0,
  };
}

/** Find best built-in table entry for an ingredient name. */
export function findNutritionEntry(
  name: string
): { key: string; entry: NutritionTableEntry } | null {
  const n = normalizeName(name);
  if (!n) return null;

  // Score candidates: exact > phrase containment > loose alias match.
  // Avoids "white rice" resolving to "brown rice" via shared alias family.
  let best: { key: string; entry: NutritionTableEntry; score: number } | null =
    null;

  for (const [key, entry] of Object.entries(NUTRITION_TABLE)) {
    const candidates = [key, ...(entry.aliases ?? [])];
    for (const c of candidates) {
      const nc = normalizeName(c);
      if (!nc) continue;
      let score = 0;
      if (n === nc) {
        score = 1000 + nc.length;
      } else if (` ${n} `.includes(` ${nc} `) || ` ${nc} `.includes(` ${n} `)) {
        score = 500 + Math.min(n.length, nc.length);
      } else if (namesMatch(name, c)) {
        score = 100 + Math.min(n.length, nc.length);
      } else {
        continue;
      }
      if (!best || score > best.score) {
        best = { key, entry, score };
      }
    }
  }

  return best ? { key: best.key, entry: best.entry } : null;
}

/**
 * Convert qty+unit → grams using entry heuristics.
 * Returns null when we cannot estimate mass (unknown unit without gPerEach).
 */
export function quantityToGrams(
  qty: number,
  unit: string,
  entry: NutritionTableEntry
): number | null {
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const key = normalizeUnitKey(unit || "each");

  const weight = WEIGHT_TO_G[key];
  if (weight != null) return qty * weight;

  if (key === "tsp" || key === "teaspoon" || key === "teaspoons") {
    if (entry.gPerTsp != null) return qty * entry.gPerTsp;
    if (entry.gPerTbsp != null) return qty * (entry.gPerTbsp / 3);
    if (entry.gPerCup != null) return qty * (entry.gPerCup / 48);
  }
  if (key === "tbsp" || key === "tablespoon" || key === "tablespoons") {
    if (entry.gPerTbsp != null) return qty * entry.gPerTbsp;
    if (entry.gPerCup != null) return qty * (entry.gPerCup / 16);
    if (entry.gPerTsp != null) return qty * entry.gPerTsp * 3;
  }

  const ml = VOLUME_TO_ML[key];
  if (ml != null) {
    const gPerCup = entry.gPerCup ?? 200; // generic dry/liquid fallback
    return qty * ml * (gPerCup / 240);
  }

  if (COUNT_UNITS.has(key)) {
    if (entry.gPerEach != null) return qty * entry.gPerEach;
    return null;
  }

  // Bare unit string that looks like count
  if (!key && entry.gPerEach != null) return qty * entry.gPerEach;

  return null;
}

export type IngredientNutritionLine = {
  name: string;
  matched: boolean;
  key?: string;
  grams?: number;
  macros?: Macros;
  source?: "table" | "pantry";
};

export type RecipeNutritionEstimate = {
  total: Macros;
  perServing: Macros;
  servings: number;
  matchedCount: number;
  totalCount: number;
  /** e.g. "Based on 5 of 6 ingredients" when partial */
  coverageLabel: string | null;
  lines: IngredientNutritionLine[];
};

export type EstimateOptions = {
  /**
   * Optional pantry / OFF nutritionJson strings keyed by ingredient or pantry name.
   * When a name matches, prefer those per-100g macros over the built-in table.
   */
  pantryNutritionByName?: Record<string, string | null | undefined>;
};

function lookupPantryMacros(
  name: string,
  map?: Record<string, string | null | undefined>
): Macros | null {
  if (!map) return null;
  for (const [pantryName, raw] of Object.entries(map)) {
    if (!namesMatch(name, pantryName)) continue;
    const snap = parseNutritionJson(raw);
    if (!snap) continue;
    return macrosFromSnapshot(snap);
  }
  return null;
}

/**
 * Estimate recipe nutrition from ingredients.
 * Sync / SSR-safe — uses built-in table (+ optional pantry nutritionJson).
 */
export function estimateRecipeNutrition(
  ingredients: { name: string; quantity: number; unit: string; optional?: boolean }[],
  servings: number,
  options?: EstimateOptions
): RecipeNutritionEstimate {
  const total = emptyMacros();
  const lines: IngredientNutritionLine[] = [];
  let matchedCount = 0;
  const safeServings =
    Number.isFinite(servings) && servings > 0 ? servings : 1;

  for (const ing of ingredients) {
    const pantryMacros = lookupPantryMacros(
      ing.name,
      options?.pantryNutritionByName
    );
    const found = findNutritionEntry(ing.name);

    // Need an entry (or at least gPerEach/volume heuristics) to convert mass.
    // Pantry OFF only gives per-100g — still need grams from table heuristics or weight units.
    const entryForGrams: NutritionTableEntry | null =
      found?.entry ??
      (pantryMacros
        ? {
            kcal: pantryMacros.kcal,
            protein: pantryMacros.protein,
            fat: pantryMacros.fat,
            carbs: pantryMacros.carbs,
            gPerCup: 200,
            gPerTbsp: 15,
            gPerTsp: 5,
            gPerEach: 100,
          }
        : null);

    if (!entryForGrams) {
      lines.push({ name: ing.name, matched: false });
      continue;
    }

    const grams = quantityToGrams(ing.quantity, ing.unit, entryForGrams);
    if (grams == null || grams <= 0) {
      lines.push({ name: ing.name, matched: false });
      continue;
    }

    const per100 = pantryMacros ?? {
      kcal: entryForGrams.kcal,
      protein: entryForGrams.protein,
      fat: entryForGrams.fat,
      carbs: entryForGrams.carbs,
      fiber: entryForGrams.fiber,
      sodium: entryForGrams.sodium,
    };

    const scale = grams / 100;
    addMacros(total, per100, scale);
    matchedCount += 1;
    lines.push({
      name: ing.name,
      matched: true,
      key: found?.key,
      grams: Math.round(grams),
      macros: roundMacros({
        kcal: per100.kcal * scale,
        protein: per100.protein * scale,
        fat: per100.fat * scale,
        carbs: per100.carbs * scale,
        fiber: (per100.fiber ?? 0) * scale,
        sodium: (per100.sodium ?? 0) * scale,
      }),
      source: pantryMacros ? "pantry" : "table",
    });
  }

  const totalCount = ingredients.length;
  const roundedTotal = roundMacros(total);
  const perServing = roundMacros({
    kcal: total.kcal / safeServings,
    protein: total.protein / safeServings,
    fat: total.fat / safeServings,
    carbs: total.carbs / safeServings,
    fiber: total.fiber / safeServings,
    sodium: total.sodium / safeServings,
  });

  let coverageLabel: string | null = null;
  if (totalCount === 0) {
    coverageLabel = null;
  } else if (matchedCount === 0) {
    coverageLabel = "No matching ingredients in the estimate table";
  } else if (matchedCount < totalCount) {
    coverageLabel = `Based on ${matchedCount} of ${totalCount} ingredients`;
  } else {
    coverageLabel = `Based on all ${totalCount} ingredients`;
  }

  return {
    total: roundedTotal,
    perServing,
    servings: safeServings,
    matchedCount,
    totalCount,
    coverageLabel,
    lines,
  };
}
