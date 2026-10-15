import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  NUTRITION_ESTIMATOR_VERSION, assessNutritionTrust, estimateRecipeNutrition, type Macros, type RecipeNutritionEstimate,
} from "@/lib/recipe-nutrition";

type RecipeInput = {
  id: string;
  title: string;
  servings: number;
  steps: string | string[] | null;
  ingredients: { name: string; quantity: number; unit: string; optional?: boolean | null }[];
};

export type SnapshotRow = {
  recipeId: string;
  version: number;
  inputHash: string;
  servings: number;
  kcal: number; protein: number; fat: number; carbs: number;
  fiber: number; sugars: number; saturatedFat: number; sodium: number;
  perServingJson: string;
  matchedCount: number; totalCount: number; coveragePct: number;
  trusted: boolean;
  reasons: string; assumptions: string; unmatched: string;
};

export function estimateForRecipe(r: RecipeInput): RecipeNutritionEstimate {
  return estimateRecipeNutrition(
    r.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, optional: Boolean(i.optional) })),
    r.servings,
    { context: { title: r.title, steps: r.steps } }
  );
}

export function inputHash(r: RecipeInput): string {
  const ing = r.ingredients.map((i) => [i.name, i.quantity, i.unit]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return crypto.createHash("sha256").update(JSON.stringify([NUTRITION_ESTIMATOR_VERSION, r.title, r.servings, r.steps, ing])).digest("hex").slice(0, 32);
}

/** Pure: build the snapshot columns from a recipe (servingsSuspect is a manual flag passed in). */
export function buildSnapshot(r: RecipeInput, servingsSuspect: boolean): SnapshotRow {
  const est = estimateForRecipe(r);
  const trust = assessNutritionTrust(est, { servingsSuspect });
  const ps: Macros = est.perServing;
  return {
    recipeId: r.id,
    version: NUTRITION_ESTIMATOR_VERSION,
    inputHash: inputHash(r),
    servings: est.servings,
    kcal: ps.kcal, protein: ps.protein, fat: ps.fat, carbs: ps.carbs,
    fiber: ps.fiber ?? 0, sugars: ps.sugars ?? 0, saturatedFat: ps.saturatedFat ?? 0, sodium: ps.sodium ?? 0,
    perServingJson: JSON.stringify(ps),
    matchedCount: est.matchedCount, totalCount: est.totalCount, coveragePct: trust.coveragePct,
    trusted: trust.trusted,
    reasons: JSON.stringify(trust.reasons),
    assumptions: JSON.stringify(est.assumptions),
    unmatched: JSON.stringify(est.lines.filter((l) => !l.matched).map((l) => l.name)),
  };
}

/**
 * Make sure each recipe has a current snapshot; recompute only when the inputs
 * hash or estimator version changed (or `force`). Returns snapshots by recipeId.
 */
export async function ensureSnapshots(recipes: RecipeInput[], opts: { force?: boolean } = {}) {
  const ids = recipes.map((r) => r.id);
  const existing = new Map((await prisma.recipeNutritionSnapshot.findMany({ where: { recipeId: { in: ids } } })).map((s) => [s.recipeId, s]));
  const out = new Map<string, Awaited<ReturnType<typeof prisma.recipeNutritionSnapshot.findMany>>[number]>();
  let recomputed = 0;
  for (const r of recipes) {
    const cur = existing.get(r.id);
    const hash = inputHash(r);
    if (cur && !opts.force && cur.inputHash === hash && cur.version === NUTRITION_ESTIMATOR_VERSION) { out.set(r.id, cur); continue; }
    const row = buildSnapshot(r, cur?.servingsSuspect ?? false);
    const saved = await prisma.recipeNutritionSnapshot.upsert({
      where: { recipeId: r.id },
      create: { ...row, computedAt: new Date() },
      update: { ...row, computedAt: new Date() },
    });
    recomputed++;
    out.set(r.id, saved);
  }
  return { snapshots: out, recomputed };
}

export async function loadAllRecipesForSnapshots() {
  return prisma.recipe.findMany({
    select: { id: true, title: true, servings: true, steps: true, ingredients: { select: { name: true, quantity: true, unit: true, optional: true } } },
    orderBy: { title: "asc" },
  });
}

/** Admin: flag/unflag a recipe's servings as needing review (recomputes trust). */
export async function setServingsSuspect(recipeId: string, suspect: boolean, note: string | null) {
  const r = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, title: true, servings: true, steps: true, ingredients: { select: { name: true, quantity: true, unit: true, optional: true } } },
  });
  if (!r) return null;
  const row = buildSnapshot(r, suspect);
  return prisma.recipeNutritionSnapshot.upsert({
    where: { recipeId },
    create: { ...row, servingsSuspect: suspect, servingsNote: note, computedAt: new Date() },
    update: { ...row, servingsSuspect: suspect, servingsNote: note, computedAt: new Date() },
  });
}
