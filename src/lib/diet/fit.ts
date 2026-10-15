import { ensureSnapshots } from "@/lib/nutrition/snapshot";
import { dietLabel, servingFit, type DietType } from "@/lib/diet/rules";
import { getDietSettings } from "@/lib/diet/service";

export type DietFit = { diet: string; dietType: DietType; ok: boolean; why: string | null; trusted: boolean };

/** "Fits keto ✓/✕" for one serving, for users who have diet settings. */
export async function recipeDietFit(
  userId: string,
  recipe: { id: string; title: string; servings: number; steps: string; vegetarianEligible: boolean; veganEligible: boolean; pescatarianEligible: boolean; ingredients: { name: string; quantity: number; unit: string; optional: boolean }[] }
): Promise<DietFit | null> {
  const settings = await getDietSettings(userId);
  if (!settings) return null;
  const { snapshots } = await ensureSnapshots([recipe]);
  const s = snapshots.get(recipe.id);
  if (!s) return null;
  const base = { diet: dietLabel(settings.dietType), dietType: settings.dietType };
  if (!s.trusted) return { ...base, ok: false, why: "Nutrition estimate isn't reliable enough for this recipe yet", trusted: false };
  const fit = servingFit(settings.dietType, { id: recipe.id, title: recipe.title, ingredientNames: recipe.ingredients.map((i) => i.name), vegetarianEligible: recipe.vegetarianEligible, veganEligible: recipe.veganEligible, pescatarianEligible: recipe.pescatarianEligible },
    { kcal: s.kcal, protein: s.protein, fat: s.fat, carbs: s.carbs, fiber: s.fiber, saturatedFat: s.saturatedFat });
  return { ...base, ok: fit.ok, why: fit.why ?? null, trusted: true };
}
