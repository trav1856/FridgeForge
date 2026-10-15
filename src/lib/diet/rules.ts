/** Diet types and their measurable rules. Pure, no I/O. */

export const DIET_TYPES = [
  { id: "balanced", label: "Balanced", blurb: "A mix of protein, carbs and fat.", split: [25, 45, 30] },
  { id: "keto", label: "Keto", blurb: "Very low carb (≤10 g net carbs a meal, ≤25 g a day), high fat.", split: [20, 5, 75] },
  { id: "low_carb", label: "Low-carb", blurb: "≤30 g carbs a meal, ≤100 g a day.", split: [30, 20, 50] },
  { id: "high_protein", label: "High-protein", blurb: "≥30% of calories and ≥25 g a meal from protein.", split: [35, 35, 30] },
  { id: "mediterranean", label: "Mediterranean", blurb: "Low saturated fat, plenty of fiber, little red meat, no processed meat.", split: [20, 45, 35] },
  { id: "vegetarian", label: "Vegetarian", blurb: "No meat or fish.", split: [20, 50, 30] },
  { id: "vegan", label: "Vegan", blurb: "No animal products.", split: [20, 50, 30] },
  { id: "pescatarian", label: "Pescatarian", blurb: "Fish OK, no other meat.", split: [20, 50, 30] },
] as const;
export type DietType = (typeof DIET_TYPES)[number]["id"];
export const DIET_IDS = DIET_TYPES.map((d) => d.id) as DietType[];
/** Under-18 accounts only get balanced plans (no keto, no deficit framing). */
export const MINOR_DIETS: DietType[] = ["balanced"];
export const KCAL_MIN_ADULT = 1200;
export const KCAL_MIN_MINOR = 1600;
export const KCAL_MAX = 4500;
export const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const dietLabel = (id: string) => DIET_TYPES.find((d) => d.id === id)?.label ?? id;
export function defaultSplit(id: DietType): [number, number, number] {
  const d = DIET_TYPES.find((x) => x.id === id) ?? DIET_TYPES[0];
  return [d.split[0], d.split[1], d.split[2]];
}

export type MealMacros = { kcal: number; protein: number; fat: number; carbs: number; fiber: number; saturatedFat: number };
export type DietRecipe = {
  id: string;
  title: string;
  ingredientNames: string[];
  vegetarianEligible: boolean;
  veganEligible: boolean;
  pescatarianEligible: boolean;
};

const GRAIN_STARCH = /\b(rice|pasta|spaghetti|noodles?|ramen|macaroni|penne|bread|tortillas?|flour|oats?|potato(es)?|sugar|honey|cornstarch|beans|banana|pancake)\b/i;
const PROCESSED_MEAT = /\b(bacon|sausages?|ham|salami|pepperoni|hot dogs?|bologna|spam|chorizo)\b/i;
const RED_MEAT = /\b(beef|steak|pork|lamb|veal|ground beef|bulgogi)\b/i;

export const netCarbs = (m: MealMacros) => Math.max(0, m.carbs - (m.fiber || 0));
export const pct = (part: number, kcal: number) => (kcal > 0 ? (part / kcal) * 100 : 0);

export function isRedMeat(r: DietRecipe) { return r.ingredientNames.some((n) => RED_MEAT.test(n)); }

/**
 * Recipe-level (ingredient) rules: true = allowed at all for this diet.
 */
export function recipeAllowed(diet: DietType, r: DietRecipe): { ok: boolean; why?: string } {
  switch (diet) {
    case "keto": {
      const hit = r.ingredientNames.find((n) => GRAIN_STARCH.test(n));
      return hit ? { ok: false, why: `contains ${hit}` } : { ok: true };
    }
    case "mediterranean": {
      const hit = r.ingredientNames.find((n) => PROCESSED_MEAT.test(n));
      return hit ? { ok: false, why: `processed meat (${hit})` } : { ok: true };
    }
    case "vegetarian": return r.vegetarianEligible ? { ok: true } : { ok: false, why: "not vegetarian" };
    case "vegan": return r.veganEligible ? { ok: true } : { ok: false, why: "not vegan" };
    case "pescatarian": return r.pescatarianEligible ? { ok: true } : { ok: false, why: "contains meat" };
    default: return { ok: true };
  }
}

/** Per-meal macro rule at the chosen portion. Hard fail → not placed; penalty → soft. */
export function mealRule(diet: DietType, m: MealMacros): { ok: boolean; penalty: number; why?: string } {
  switch (diet) {
    case "keto": {
      const nc = netCarbs(m);
      if (nc > 10) return { ok: false, penalty: 0, why: `${Math.round(nc)} g net carbs (max 10)` };
      return { ok: true, penalty: Math.max(0, 60 - pct(m.fat * 9, m.kcal)) * 0.5 };
    }
    case "low_carb":
      return m.carbs > 30 ? { ok: false, penalty: 0, why: `${Math.round(m.carbs)} g carbs (max 30)` } : { ok: true, penalty: 0 };
    case "high_protein": {
      const p = pct(m.protein * 4, m.kcal);
      if (p < 30 || m.protein < 25) return { ok: false, penalty: 0, why: `${Math.round(m.protein)} g protein, ${Math.round(p)}% (needs ≥25 g and ≥30%)` };
      return { ok: true, penalty: 0 };
    }
    case "mediterranean": {
      const sf = pct((m.saturatedFat || 0) * 9, m.kcal);
      if (sf > 10) return { ok: false, penalty: 0, why: `saturated fat ${Math.round(sf)}% of calories (max 10%)` };
      return { ok: true, penalty: m.fiber >= 5 ? 0 : (5 - m.fiber) * 2 };
    }
    default:
      return { ok: true, penalty: 0 };
  }
}

/** Day-level caps. */
export function dayCaps(diet: DietType): { netCarbsMax?: number; carbsMax?: number } {
  if (diet === "keto") return { netCarbsMax: 25 };
  if (diet === "low_carb") return { carbsMax: 100 };
  return {};
}

/** Diet fit for a single serving (recipe badges). */
export function servingFit(diet: DietType, r: DietRecipe, m: MealMacros): { ok: boolean; why?: string } {
  const a = recipeAllowed(diet, r);
  if (!a.ok) return a;
  const rule = mealRule(diet, m);
  return rule.ok ? { ok: true } : { ok: false, why: rule.why };
}
