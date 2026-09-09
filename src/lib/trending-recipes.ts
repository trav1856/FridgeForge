/**
 * Homepage "Popular this week" ranking helpers.
 * Prefer real favorite signals; fall back to a shuffled shared-catalog sample
 * without fabricating favorite counts.
 */

export type TrendingCandidate = {
  id: string;
  title: string;
  /** Shared catalog when null */
  householdId: string | null;
  /** private | household | public */
  visibility: string;
  favoriteCount: number;
  /** True when counts come from real favorites (week or all-time). */
  hasRealSignal: boolean;
};

export type RankedTrending<T extends { id: string }> = {
  recipe: T;
  favoriteCount: number | null;
  source: "week" | "all_time" | "fallback";
};

/**
 * Whether a recipe may appear on the public trending strip.
 * Shared catalog always; household recipes only when marked public
 * (private household recipes stay out of the homepage for others).
 */
export function isTrendingEligible(recipe: {
  householdId: string | null;
  visibility?: string | null;
}): boolean {
  if (recipe.householdId == null) return true;
  const v = (recipe.visibility ?? "").toLowerCase();
  return v === "public" || v === "global";
}

/** Fisher–Yates shuffle (injectable rng). */
export function shuffleInPlace<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Rank candidates: week favorites → all-time → shuffled fallback.
 * `week` / `allTime` should already be filtered to eligible recipes and
 * sorted by count desc. `fallbackPool` is used only when both are empty.
 */
export function pickTrendingRecipes<T extends { id: string }>(
  week: { recipe: T; favoriteCount: number }[],
  allTime: { recipe: T; favoriteCount: number }[],
  fallbackPool: T[],
  limit = 6,
  rng: () => number = Math.random
): RankedTrending<T>[] {
  if (week.length > 0) {
    return week.slice(0, limit).map((row) => ({
      recipe: row.recipe,
      favoriteCount: row.favoriteCount,
      source: "week" as const,
    }));
  }
  if (allTime.length > 0) {
    return allTime.slice(0, limit).map((row) => ({
      recipe: row.recipe,
      favoriteCount: row.favoriteCount,
      source: "all_time" as const,
    }));
  }
  const shuffled = shuffleInPlace([...fallbackPool], rng).slice(0, limit);
  return shuffled.map((recipe) => ({
    recipe,
    favoriteCount: null,
    source: "fallback" as const,
  }));
}
