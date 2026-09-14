/**
 * Pick featured dish-family variants: top rated, oldest, surprise —
 * then return the remaining recipes for the same dishKey.
 */

export type DishVariantCandidate = {
  id: string;
  title: string;
  imageUrl: string | null;
  createdAt: Date | string;
  averageStars: number | null;
  reviewCount: number;
};

export type DishVariantRole = "top-rated" | "oldest" | "surprise";

export const DISH_VARIANT_ROLE_LABEL: Record<DishVariantRole, string> = {
  "top-rated": "Top rated",
  oldest: "Oldest",
  surprise: "Surprise",
};

export type FeaturedDishVariant<T extends DishVariantCandidate> = {
  role: DishVariantRole;
  label: string;
  recipe: T;
};

export type DishVariantPicks<T extends DishVariantCandidate> = {
  featured: FeaturedDishVariant<T>[];
  rest: T[];
};

function createdAtMs(v: DishVariantCandidate): number {
  const t =
    v.createdAt instanceof Date
      ? v.createdAt.getTime()
      : new Date(v.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Higher average stars first; tie-break review count, then recency. */
export function compareTopRated(
  a: DishVariantCandidate,
  b: DishVariantCandidate
): number {
  const aStars = a.averageStars;
  const bStars = b.averageStars;
  const aHas = aStars != null && Number.isFinite(aStars) && a.reviewCount > 0;
  const bHas = bStars != null && Number.isFinite(bStars) && b.reviewCount > 0;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  if (aHas && bHas) {
    if (aStars !== bStars) return (bStars as number) - (aStars as number);
    if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
  }
  // Recency: newer first
  return createdAtMs(b) - createdAtMs(a);
}

/** Earlier createdAt first (classic / first in catalog). */
export function compareOldest(
  a: DishVariantCandidate,
  b: DishVariantCandidate
): number {
  const diff = createdAtMs(a) - createdAtMs(b);
  if (diff !== 0) return diff;
  return a.id.localeCompare(b.id);
}

function byTitle(a: DishVariantCandidate, b: DishVariantCandidate): number {
  return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

/**
 * Choose up to three distinct featured variants for a dish family, then the rest.
 * - Top rated: best average stars (review count / recency tie-breaks)
 * - Oldest: earliest createdAt among remaining (distinct when possible)
 * - Surprise: random among remaining (injectable rng)
 *
 * Does not invent placeholders when fewer than three exist.
 */
export function pickDishVariantHighlights<T extends DishVariantCandidate>(
  variants: T[],
  options?: { rng?: () => number }
): DishVariantPicks<T> {
  if (variants.length === 0) return { featured: [], rest: [] };

  const rng = options?.rng ?? Math.random;
  const pool = [...variants];
  const featured: FeaturedDishVariant<T>[] = [];
  const used = new Set<string>();

  const topRated = [...pool].sort(compareTopRated)[0]!;
  featured.push({
    role: "top-rated",
    label: DISH_VARIANT_ROLE_LABEL["top-rated"],
    recipe: topRated,
  });
  used.add(topRated.id);

  const oldestCandidate = [...pool]
    .sort(compareOldest)
    .find((r) => !used.has(r.id));
  if (oldestCandidate) {
    featured.push({
      role: "oldest",
      label: DISH_VARIANT_ROLE_LABEL.oldest,
      recipe: oldestCandidate,
    });
    used.add(oldestCandidate.id);
  }

  const remainingForSurprise = pool.filter((r) => !used.has(r.id));
  if (remainingForSurprise.length > 0) {
    const idx = Math.min(
      remainingForSurprise.length - 1,
      Math.max(0, Math.floor(rng() * remainingForSurprise.length))
    );
    const surprise = remainingForSurprise[idx]!;
    featured.push({
      role: "surprise",
      label: DISH_VARIANT_ROLE_LABEL.surprise,
      recipe: surprise,
    });
    used.add(surprise.id);
  }

  const rest = pool.filter((r) => !used.has(r.id)).sort(byTitle);
  return { featured, rest };
}
