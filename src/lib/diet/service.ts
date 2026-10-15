import { prisma } from "@/lib/db";
import { ageOn, parseBirthDate } from "@/lib/age-gate";
import { conflictingAllergens } from "@/lib/allergens";
import { resolveDietarySuggestOptions, passesMacroDietaryFilter } from "@/lib/dietary";
import { dedupeRecipesByTitle } from "@/lib/dedupe-recipes";
import { recipeIsReadable } from "@/lib/recipe-request";
import { recipeScopeWhere } from "@/lib/household";
import { ensureSnapshots } from "@/lib/nutrition/snapshot";
import { DIET_IDS, KCAL_MAX, KCAL_MIN_ADULT, KCAL_MIN_MINOR, MINOR_DIETS, PORTIONS, defaultSplit, type DietType } from "@/lib/diet/rules";
import { buildWeek, type Candidate, type DietWeekPlan, type Settings } from "@/lib/diet/planner";
import type { AuthUser } from "@/lib/auth";

export class DietError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = "DietError"; this.status = status; }
}

export type DietSettingsDTO = {
  dietType: DietType; kcalTarget: number; mealsPerDay: number; split: [number, number, number]; customSplit: boolean;
  tolerancePct: number; ageBand: "adult" | "minor"; disclaimerAcceptedAt: string;
};

export function toSettings(d: DietSettingsDTO): Settings {
  return { dietType: d.dietType, kcalTarget: d.kcalTarget, mealsPerDay: d.mealsPerDay, split: d.split, tolerancePct: d.tolerancePct };
}

export async function getDietSettings(userId: string): Promise<DietSettingsDTO | null> {
  const s = await prisma.userDietSettings.findUnique({ where: { userId } });
  if (!s) return null;
  const dietType = (DIET_IDS.includes(s.dietType as DietType) ? s.dietType : "balanced") as DietType;
  const custom = s.proteinPct != null && s.carbsPct != null && s.fatPct != null;
  return {
    dietType: s.ageBand === "minor" ? "balanced" : dietType,
    kcalTarget: s.kcalTarget, mealsPerDay: s.mealsPerDay,
    split: custom ? [s.proteinPct!, s.carbsPct!, s.fatPct!] : defaultSplit(dietType),
    customSplit: custom, tolerancePct: s.tolerancePct,
    ageBand: s.ageBand === "minor" ? "minor" : "adult", disclaimerAcceptedAt: s.disclaimerAcceptedAt.toISOString(),
  };
}

/** Pure validation shared by API + tests. */
export function validateSettings(
  input: { dietType: string; kcalTarget: number; mealsPerDay: number; split?: [number, number, number] | null },
  ageBand: "adult" | "minor"
): { dietType: DietType; kcalTarget: number; mealsPerDay: number; split: [number, number, number] | null } {
  if (!DIET_IDS.includes(input.dietType as DietType)) throw new DietError("Pick a diet type.");
  if (ageBand === "minor" && !MINOR_DIETS.includes(input.dietType as DietType)) throw new DietError("Under-18 accounts can use balanced plans only.");
  const min = ageBand === "minor" ? KCAL_MIN_MINOR : KCAL_MIN_ADULT;
  if (input.kcalTarget < min || input.kcalTarget > KCAL_MAX) throw new DietError(`Daily calories must be between ${min.toLocaleString()} and ${KCAL_MAX.toLocaleString()}.`);
  if (input.mealsPerDay < 2 || input.mealsPerDay > 5) throw new DietError("Meals per day must be 2–5.");
  let split: [number, number, number] | null = null;
  if (input.split && ageBand === "adult") {
    const [p, c, f] = input.split;
    if (p + c + f !== 100) throw new DietError("Protein, carbs and fat must add up to 100%.");
    if (p < 10 || f < 10) throw new DietError("Protein and fat each need at least 10%.");
    split = [p, c, f];
  }
  return { dietType: input.dietType as DietType, kcalTarget: input.kcalTarget, mealsPerDay: input.mealsPerDay, split };
}

export async function saveDietSettings(
  userId: string,
  input: { dietType: string; kcalTarget: number; mealsPerDay: number; split?: [number, number, number] | null; birthDate?: string },
  now = new Date()
): Promise<DietSettingsDTO> {
  const existing = await prisma.userDietSettings.findUnique({ where: { userId } });
  let ageBand = existing?.ageBand as "adult" | "minor" | undefined;
  if (!ageBand) {
    const b = parseBirthDate(input.birthDate);
    if (!b) throw new DietError("Enter your date of birth (checked once, not stored).");
    const age = ageOn(b, now);
    if (age < 0 || age > 120) throw new DietError("Enter a valid date of birth.");
    ageBand = age >= 18 ? "adult" : "minor";
  }
  const v = validateSettings(input, ageBand);
  const data = {
    dietType: v.dietType, kcalTarget: v.kcalTarget, mealsPerDay: v.mealsPerDay,
    proteinPct: v.split?.[0] ?? null, carbsPct: v.split?.[1] ?? null, fatPct: v.split?.[2] ?? null,
    ageBand, disclaimerAcceptedAt: now,
  };
  await prisma.userDietSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return (await getDietSettings(userId))!;
}

/** Visible recipes → candidates with trusted snapshot macros, hard-filtered for allergens and account prefs. */
export async function loadCandidates(user: AuthUser, householdId: string | null): Promise<{ pool: Candidate[]; excluded: { allergens: number; prefs: number; untrusted: number } }> {
  const raw = await prisma.recipe.findMany({
    where: { OR: [recipeScopeWhere(householdId), { visibility: { in: ["global", "public"] } }] },
    include: { ingredients: true, shares: { select: { toUserId: true, toUserEmail: true, toHouseholdId: true } } },
  });
  const readable = dedupeRecipesByTitle(raw.filter((r) => recipeIsReadable(r, householdId, { userId: user.id, userEmail: user.email })), householdId);
  const { snapshots } = await ensureSnapshots(readable);
  const prefs = resolveDietarySuggestOptions(user);
  const excluded = { allergens: 0, prefs: 0, untrusted: 0 };
  const pool: Candidate[] = [];
  for (const r of readable) {
    const ingredientNames = r.ingredients.map((i) => i.name);
    if (conflictingAllergens({ allergenTags: r.allergenTags, title: r.title, description: r.description, tags: r.tags, ingredients: r.ingredients, steps: r.steps }, user.allergenFlags).length) { excluded.allergens++; continue; }
    // Account plant prefs are strict here (adapt notes don't count: the numbers are for the recipe as written).
    if ((prefs.requireVegan && !r.veganEligible) || (prefs.requireVegetarian && !r.vegetarianEligible) || (prefs.requirePescatarian && !r.pescatarianEligible) || !passesMacroDietaryFilter(r, prefs)) { excluded.prefs++; continue; }
    const s = snapshots.get(r.id);
    if (!s?.trusted) excluded.untrusted++;
    let tags: string[] = []; try { tags = JSON.parse(r.tags || "[]"); } catch { /* ignore */ }
    pool.push({
      id: r.id, title: r.title, course: r.course ?? null, tags, dishKey: r.dishKey ?? null, imageUrl: r.imageUrl ?? null, ingredientNames,
      vegetarianEligible: r.vegetarianEligible, veganEligible: r.veganEligible, pescatarianEligible: r.pescatarianEligible,
      trusted: Boolean(s?.trusted),
      macros: { kcal: s?.kcal ?? 0, protein: s?.protein ?? 0, fat: s?.fat ?? 0, carbs: s?.carbs ?? 0, fiber: s?.fiber ?? 0, saturatedFat: s?.saturatedFat ?? 0 },
    });
  }
  return { pool, excluded };
}

export async function getSavedPlan(userId: string): Promise<DietWeekPlan | null> {
  const row = await prisma.dietMenuPlan.findUnique({ where: { userId } });
  if (!row) return null;
  try { const p = JSON.parse(row.planJson) as DietWeekPlan; return p?.version === 1 ? p : null; } catch { return null; }
}
export async function savePlan(userId: string, plan: DietWeekPlan) {
  await prisma.dietMenuPlan.upsert({ where: { userId }, create: { userId, planJson: JSON.stringify(plan) }, update: { planJson: JSON.stringify(plan) } });
}

export function localTodayISO(now = new Date()): string {
  const d = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function newWeek(pool: Candidate[], settings: Settings, seed: number, previous?: DietWeekPlan | null) {
  return buildWeek(pool, settings, localTodayISO(), seed, previous);
}

export const isPortion = (n: unknown): n is number => typeof n === "number" && (PORTIONS as readonly number[]).includes(n);
