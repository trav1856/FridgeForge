/**
 * Weekly menu builder — 7-day breakfast / lunch / dinner from pantry + recipes.
 * Reuses Cook Now scoring (suggestMeals / scoreRecipe); adds course pools +
 * anti-repeat preference across the week.
 */

import { suggestMeals, type SuggestOptions } from "./suggestions";
import type {
  PantrySnapshot,
  RecipeForMatch,
  SuggestionResult,
} from "./types";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export type MenuSlotPick = {
  recipeId: string;
  title: string;
  score: number;
  matchRatio: number;
  missingIngredients: string[];
  missingCount: number;
  canMakeNow: boolean;
  nearMiss: boolean;
  imageUrl?: string | null;
  cookTimeMinutes?: number | null;
  isStruggleMeal: boolean;
  costTier: string;
  course?: string | null;
  tags: string[];
};

export type MenuDay = {
  dayIndex: number;
  dayLabel: string;
  dateISO: string;
  slots: Record<MealSlot, MenuSlotPick | null>;
};

export type WeeklyMenuPlanData = {
  days: MenuDay[];
  struggleMode: boolean;
  generatedAt: string;
};

export type WeeklyMenuOptions = SuggestOptions & {
  /** Start date for the 7-day window (local calendar). Default: today. */
  startDate?: Date;
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const BREAKFAST_RE =
  /\b(breakfast|brunch|pancake|waffle|oatmeal|scrambl|omelet|omelette|toast|bagel|cereal|muffin|hash\b|french toast|granola|yogurt)/i;

/** Resolve which meal slots a recipe is a reasonable pick for. */
export function recipeFitsMealSlot(
  recipe: RecipeForMatch,
  slot: MealSlot
): boolean {
  const course = (recipe.course || "").trim().toLowerCase();
  const blob = `${recipe.title} ${(recipe.tags || []).join(" ")}`;

  if (course === "dessert" || course === "drink") return false;

  if (slot === "breakfast") {
    if (course === "breakfast") return true;
    if (course === "snack" && BREAKFAST_RE.test(blob)) return true;
    if (!course && BREAKFAST_RE.test(blob)) return true;
    if (
      !course &&
      recipe.tags.some((t) => /breakfast|brunch/i.test(t))
    ) {
      return true;
    }
    return false;
  }

  // Lunch / dinner: skip dedicated breakfast recipes
  if (course === "breakfast") return false;
  if (!course && BREAKFAST_RE.test(blob)) return false;

  if (slot === "lunch") {
    if (
      !course ||
      course === "lunch" ||
      course === "main" ||
      course === "side" ||
      course === "starter" ||
      course === "dinner" ||
      course === "snack"
    ) {
      return true;
    }
    return false;
  }

  // dinner
  if (
    !course ||
    course === "dinner" ||
    course === "main" ||
    course === "side" ||
    course === "starter" ||
    course === "lunch"
  ) {
    return true;
  }
  return false;
}

function poolForSlot(
  scored: SuggestionResult[],
  slot: MealSlot
): SuggestionResult[] {
  const fitted = scored.filter((s) => recipeFitsMealSlot(s.recipe, slot));
  if (fitted.length > 0) return fitted;
  // Soft fallback so empty taxonomies still fill a week
  return scored.filter((s) => {
    const c = (s.recipe.course || "").trim().toLowerCase();
    if (c === "dessert" || c === "drink") return false;
    if (slot !== "breakfast" && c === "breakfast") return false;
    return true;
  });
}

export function toSlotPick(s: SuggestionResult): MenuSlotPick {
  return {
    recipeId: s.recipe.id,
    title: s.recipe.title,
    score: s.score,
    matchRatio: s.matchRatio,
    missingIngredients: s.missingIngredients,
    missingCount: s.missingCount,
    canMakeNow: s.canMakeNow,
    nearMiss: s.nearMiss,
    imageUrl: s.recipe.imageUrl ?? null,
    cookTimeMinutes: s.recipe.cookTimeMinutes ?? null,
    isStruggleMeal: s.recipe.isStruggleMeal,
    costTier: s.recipe.costTier,
    course: s.recipe.course ?? null,
    tags: s.recipe.tags,
  };
}

/**
 * Prefer higher pantry score; subtract a repeat penalty so the same recipe
 * is avoided across the week when alternatives exist.
 */
export function pickForSlot(
  pool: SuggestionResult[],
  usedCounts: Map<string, number>,
  options: { excludeIds?: Set<string>; repeatPenalty?: number } = {}
): SuggestionResult | null {
  const { excludeIds = new Set(), repeatPenalty = 35 } = options;
  const ranked = pool
    .filter((s) => !excludeIds.has(s.recipe.id))
    .map((s) => {
      const used = usedCounts.get(s.recipe.id) || 0;
      return { s, adj: s.score - used * repeatPenalty };
    })
    .sort((a, b) => {
      if (b.adj !== a.adj) return b.adj - a.adj;
      // Stable tie-break: prefer unused, then title
      const ua = usedCounts.get(a.s.recipe.id) || 0;
      const ub = usedCounts.get(b.s.recipe.id) || 0;
      if (ua !== ub) return ua - ub;
      return a.s.recipe.title.localeCompare(b.s.recipe.title);
    });

  return ranked[0]?.s ?? null;
}

export function nextSevenDays(startDate: Date = new Date()): Omit<
  MenuDay,
  "slots"
>[] {
  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);
  return Array.from({ length: 7 }, (_, dayIndex) => {
    const d = new Date(start);
    d.setDate(start.getDate() + dayIndex);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return {
      dayIndex,
      dayLabel: WEEKDAY[d.getDay()]!,
      dateISO: `${y}-${m}-${day}`,
    };
  });
}

function countUsedInPlan(days: MenuDay[]): Map<string, number> {
  const used = new Map<string, number>();
  for (const day of days) {
    for (const slot of MEAL_SLOTS) {
      const pick = day.slots[slot];
      if (!pick) continue;
      used.set(pick.recipeId, (used.get(pick.recipeId) || 0) + 1);
    }
  }
  return used;
}

export function buildWeeklyMenu(
  recipes: RecipeForMatch[],
  pantry: PantrySnapshot[],
  options: WeeklyMenuOptions = {}
): WeeklyMenuPlanData {
  const struggleMode = Boolean(options.struggleMode);
  const scored = suggestMeals(recipes, pantry, {
    struggleMode,
    maxMissing: options.maxMissing ?? 3,
    maxMinutes: options.maxMinutes,
    includeUnknownTime: options.includeUnknownTime,
    mood: options.mood,
    q: options.q,
  });

  const dayMetas = nextSevenDays(options.startDate);
  const days: MenuDay[] = dayMetas.map((meta) => ({
    ...meta,
    slots: { breakfast: null, lunch: null, dinner: null },
  }));

  const usedCounts = new Map<string, number>();

  for (const day of days) {
    for (const slot of MEAL_SLOTS) {
      const pool = poolForSlot(scored, slot);
      // Avoid using the same recipe twice in one day when alternatives exist
      const sameDayIds = new Set(
        MEAL_SLOTS.map((s) => day.slots[s]?.recipeId).filter(
          (id): id is string => Boolean(id)
        )
      );
      const pick = pickForSlot(pool, usedCounts, { excludeIds: sameDayIds });
      if (pick) {
        day.slots[slot] = toSlotPick(pick);
        usedCounts.set(
          pick.recipe.id,
          (usedCounts.get(pick.recipe.id) || 0) + 1
        );
      }
    }
  }

  return {
    days,
    struggleMode,
    generatedAt: new Date().toISOString(),
  };
}

/** Replace a single day/slot pick, avoiding the previous recipe when possible. */
export function regenerateMenuSlot(
  plan: WeeklyMenuPlanData,
  dayIndex: number,
  slot: MealSlot,
  recipes: RecipeForMatch[],
  pantry: PantrySnapshot[],
  options: WeeklyMenuOptions = {}
): WeeklyMenuPlanData {
  const struggleMode =
    options.struggleMode !== undefined
      ? Boolean(options.struggleMode)
      : plan.struggleMode;

  const scored = suggestMeals(recipes, pantry, {
    struggleMode,
    maxMissing: options.maxMissing ?? 3,
    maxMinutes: options.maxMinutes,
    includeUnknownTime: options.includeUnknownTime,
    mood: options.mood,
    q: options.q,
  });

  const days = plan.days.map((d) => ({
    ...d,
    slots: { ...d.slots },
  }));
  const day = days.find((d) => d.dayIndex === dayIndex);
  if (!day) return plan;

  const previousId = day.slots[slot]?.recipeId;
  // Count usage excluding the slot we're replacing
  day.slots[slot] = null;
  const usedCounts = countUsedInPlan(days);
  const sameDayIds = new Set(
    MEAL_SLOTS.map((s) => day.slots[s]?.recipeId).filter(
      (id): id is string => Boolean(id)
    )
  );
  if (previousId) sameDayIds.add(previousId);

  const pool = poolForSlot(scored, slot);
  const pick = pickForSlot(pool, usedCounts, { excludeIds: sameDayIds });
  // If nothing else fits, allow re-picking previous rather than leaving blank
  const fallback =
    pick ??
    pickForSlot(pool, usedCounts, {
      excludeIds: new Set(
        MEAL_SLOTS.map((s) => day.slots[s]?.recipeId).filter(
          (id): id is string => Boolean(id)
        )
      ),
    });

  day.slots[slot] = fallback ? toSlotPick(fallback) : null;

  return {
    days,
    struggleMode,
    generatedAt: new Date().toISOString(),
  };
}

/** Unique missing ingredient names across the whole plan (for shopping list). */
export function collectMissingFromPlan(plan: WeeklyMenuPlanData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const day of plan.days) {
    for (const slot of MEAL_SLOTS) {
      const pick = day.slots[slot];
      if (!pick) continue;
      for (const name of pick.missingIngredients) {
        const key = name.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(name);
      }
    }
  }
  return out;
}

/** How often each recipe id appears in the plan (for tests / UI). */
export function recipeRepeatCounts(plan: WeeklyMenuPlanData): Map<string, number> {
  return countUsedInPlan(plan.days);
}
