/**
 * Weekly menu builder — 7-day breakfast / lunch / dinner from pantry + recipes.
 * Reuses Cook Now scoring (suggestMeals / scoreRecipe); adds course pools +
 * hard unused-first / dishKey diversification, with optional weighted random
 * among top candidates so regenerate actually changes the week.
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
  kosherEligible: boolean;
  halalEligible: boolean;
  vegetarianEligible: boolean;
  pescatarianEligible: boolean;
  veganEligible: boolean;
  veganAdaptNote?: string | null;
  vegetarianAdaptNote?: string | null;
  costTier: string;
  course?: string | null;
  tags: string[];
  dishKey?: string | null;
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
  /**
   * When true, pick with weighted random among the top unused candidates
   * instead of always taking #1. Use for regenerate so each click can differ.
   */
  randomize?: boolean;
  /** Optional RNG in [0, 1). Defaults to Math.random when randomize is on. */
  rng?: () => number;
  /** How many top-scoring candidates to include in the weighted draw. */
  topN?: number;
  /** Soft score penalty per prior use (only matters once unused pool is empty). */
  repeatPenalty?: number;
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const BREAKFAST_RE =
  /\b(breakfast|brunch|pancake|waffle|oatmeal|scrambl|omelet|omelette|toast|bagel|cereal|muffin|hash\b|french toast|granola|yogurt)/i;

/** Deterministic PRNG (mulberry32) for seeded regenerate tests. */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

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
    kosherEligible: Boolean(s.recipe.kosherEligible),
    halalEligible: Boolean(s.recipe.halalEligible),
    vegetarianEligible: Boolean(s.recipe.vegetarianEligible),
    pescatarianEligible: Boolean(s.recipe.pescatarianEligible),
    veganEligible: Boolean(s.recipe.veganEligible),
    veganAdaptNote: s.recipe.veganAdaptNote ?? null,
    vegetarianAdaptNote: s.recipe.vegetarianAdaptNote ?? null,
    costTier: s.recipe.costTier,
    course: s.recipe.course ?? null,
    tags: s.recipe.tags,
    dishKey: s.recipe.dishKey ?? null,
  };
}

function weightedPickFromTop(
  ranked: { s: SuggestionResult; adj: number }[],
  topN: number,
  rng: () => number
): SuggestionResult | null {
  const top = ranked.slice(0, Math.max(1, Math.min(topN, ranked.length)));
  if (top.length === 0) return null;
  if (top.length === 1) return top[0]!.s;

  // Weights from adjusted score so higher-ranked picks stay likelier
  const weights = top.map((x) => Math.max(x.adj, 0) + 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return top[i]!.s;
  }
  return top[top.length - 1]!.s;
}

export type PickForSlotOptions = {
  excludeIds?: Set<string>;
  /** Prior dishKey usage across the week (only keys that appeared). */
  usedDishKeys?: Map<string, number>;
  /** Soft penalty once reuse is required. Default 35. */
  repeatPenalty?: number;
  /** Weighted random among top unused candidates. */
  randomize?: boolean;
  rng?: () => number;
  /** Candidates considered when randomize is on. Default 5. */
  topN?: number;
};

/**
 * Prefer unused recipe ids (hard), then unused dishKeys (hard when present),
 * then higher pantry score. With randomize, draw among the top N by adj score
 * instead of always taking #1 — so regenerate can change the plan.
 */
export function pickForSlot(
  pool: SuggestionResult[],
  usedCounts: Map<string, number>,
  options: PickForSlotOptions = {}
): SuggestionResult | null {
  const {
    excludeIds = new Set(),
    usedDishKeys = new Map(),
    repeatPenalty = 35,
    randomize = false,
    rng = Math.random,
    topN = 5,
  } = options;

  let candidates = pool.filter((s) => !excludeIds.has(s.recipe.id));
  if (candidates.length === 0) return null;

  // 1) Hard prefer recipes not yet used this week
  const unusedById = candidates.filter(
    (s) => (usedCounts.get(s.recipe.id) || 0) === 0
  );
  if (unusedById.length > 0) candidates = unusedById;

  // 2) Hard prefer dishKeys not yet used (when dishKey is set)
  const freshDishKey = candidates.filter((s) => {
    const key = s.recipe.dishKey?.trim();
    if (!key) return true; // no dishKey → treat as fine for this filter
    return (usedDishKeys.get(key) || 0) === 0;
  });
  if (freshDishKey.length > 0) candidates = freshDishKey;

  const ranked = candidates
    .map((s) => {
      const used = usedCounts.get(s.recipe.id) || 0;
      const dk = s.recipe.dishKey?.trim();
      const dishUsed = dk ? usedDishKeys.get(dk) || 0 : 0;
      const adj = s.score - used * repeatPenalty - dishUsed * (repeatPenalty / 2);
      return { s, adj };
    })
    .sort((a, b) => {
      if (b.adj !== a.adj) return b.adj - a.adj;
      const ua = usedCounts.get(a.s.recipe.id) || 0;
      const ub = usedCounts.get(b.s.recipe.id) || 0;
      if (ua !== ub) return ua - ub;
      return a.s.recipe.title.localeCompare(b.s.recipe.title);
    });

  if (randomize) {
    return weightedPickFromTop(ranked, topN, rng);
  }
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

function countDishKeysInPlan(days: MenuDay[]): Map<string, number> {
  const used = new Map<string, number>();
  for (const day of days) {
    for (const slot of MEAL_SLOTS) {
      const pick = day.slots[slot];
      const key = pick?.dishKey?.trim();
      if (!key) continue;
      used.set(key, (used.get(key) || 0) + 1);
    }
  }
  return used;
}

function recordPick(
  pick: SuggestionResult,
  usedCounts: Map<string, number>,
  usedDishKeys: Map<string, number>
) {
  usedCounts.set(pick.recipe.id, (usedCounts.get(pick.recipe.id) || 0) + 1);
  const dk = pick.recipe.dishKey?.trim();
  if (dk) usedDishKeys.set(dk, (usedDishKeys.get(dk) || 0) + 1);
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
  const usedDishKeys = new Map<string, number>();
  const pickOpts: PickForSlotOptions = {
    repeatPenalty: options.repeatPenalty,
    randomize: Boolean(options.randomize),
    rng: options.rng,
    topN: options.topN ?? 5,
    usedDishKeys,
  };

  for (const day of days) {
    for (const slot of MEAL_SLOTS) {
      const pool = poolForSlot(scored, slot);
      // Avoid using the same recipe twice in one day when alternatives exist
      const sameDayIds = new Set(
        MEAL_SLOTS.map((s) => day.slots[s]?.recipeId).filter(
          (id): id is string => Boolean(id)
        )
      );
      const pick = pickForSlot(pool, usedCounts, {
        ...pickOpts,
        excludeIds: sameDayIds,
      });
      if (pick) {
        day.slots[slot] = toSlotPick(pick);
        recordPick(pick, usedCounts, usedDishKeys);
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
  const usedDishKeys = countDishKeysInPlan(days);
  const sameDayIds = new Set(
    MEAL_SLOTS.map((s) => day.slots[s]?.recipeId).filter(
      (id): id is string => Boolean(id)
    )
  );
  if (previousId) sameDayIds.add(previousId);

  const pool = poolForSlot(scored, slot);
  const pickOpts: PickForSlotOptions = {
    excludeIds: sameDayIds,
    usedDishKeys,
    repeatPenalty: options.repeatPenalty,
    // Slot regen should vary when alternatives exist
    randomize: options.randomize !== false,
    rng: options.rng,
    topN: options.topN ?? 5,
  };
  const pick = pickForSlot(pool, usedCounts, pickOpts);
  // If nothing else fits, allow re-picking previous rather than leaving blank
  const fallback =
    pick ??
    pickForSlot(pool, usedCounts, {
      ...pickOpts,
      excludeIds: new Set(
        MEAL_SLOTS.map((s) => day.slots[s]?.recipeId).filter(
          (id): id is string => Boolean(id)
        )
      ),
      randomize: false,
    });

  day.slots[slot] = fallback ? toSlotPick(fallback) : null;

  return {
    days,
    struggleMode,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Rebuild breakfast/lunch/dinner for one day. Prefer unused recipes across the
 * rest of the week, avoid the day's previous three recipe ids when alternatives
 * exist, and randomize among top candidates (same variety path as week regen).
 */
export function regenerateMenuDay(
  plan: WeeklyMenuPlanData,
  dayIndex: number,
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

  const previousIds = new Set(
    MEAL_SLOTS.map((s) => day.slots[s]?.recipeId).filter(
      (id): id is string => Boolean(id)
    )
  );

  // Clear the day so usage counts exclude its old picks
  day.slots = { breakfast: null, lunch: null, dinner: null };
  const usedCounts = countUsedInPlan(days);
  const usedDishKeys = countDishKeysInPlan(days);

  const pickOpts: PickForSlotOptions = {
    usedDishKeys,
    repeatPenalty: options.repeatPenalty,
    randomize: options.randomize !== false,
    rng: options.rng,
    topN: options.topN ?? 5,
  };

  for (const slot of MEAL_SLOTS) {
    const pool = poolForSlot(scored, slot);
    const sameDayIds = new Set(
      MEAL_SLOTS.map((s) => day.slots[s]?.recipeId).filter(
        (id): id is string => Boolean(id)
      )
    );
    // Prefer not reusing this day's previous trio when alternatives exist
    const exclude = new Set([...sameDayIds, ...previousIds]);
    let pick = pickForSlot(pool, usedCounts, {
      ...pickOpts,
      excludeIds: exclude,
    });
    if (!pick) {
      // Soften: still avoid same-day duplicates, allow previous day's ids
      pick = pickForSlot(pool, usedCounts, {
        ...pickOpts,
        excludeIds: sameDayIds,
      });
    }
    if (!pick) {
      pick = pickForSlot(pool, usedCounts, {
        ...pickOpts,
        excludeIds: new Set(
          MEAL_SLOTS.map((s) => day.slots[s]?.recipeId).filter(
            (id): id is string => Boolean(id)
          )
        ),
        randomize: false,
      });
    }
    if (pick) {
      day.slots[slot] = toSlotPick(pick);
      recordPick(pick, usedCounts, usedDishKeys);
    }
  }

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
