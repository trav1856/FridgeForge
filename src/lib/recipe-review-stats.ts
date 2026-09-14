import { prisma } from "@/lib/db";
import {
  EMPTY_REVIEW_STATS,
  roundAverageStars,
  type RecipeReviewStats,
} from "@/lib/recipe-review";

/**
 * One groupBy for many recipe ids — attach averageStars + reviewCount without N+1.
 */
export async function getReviewStatsByRecipeIds(
  recipeIds: string[]
): Promise<Map<string, RecipeReviewStats>> {
  const map = new Map<string, RecipeReviewStats>();
  const unique = [...new Set(recipeIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const groups = await prisma.recipeReview.groupBy({
    by: ["recipeId"],
    where: { recipeId: { in: unique } },
    _avg: { stars: true },
    _count: { _all: true },
  });

  for (const g of groups) {
    const count = g._count._all;
    map.set(g.recipeId, {
      averageStars: count > 0 ? roundAverageStars(g._avg.stars) : null,
      reviewCount: count,
    });
  }
  return map;
}

export function reviewStatsFor(
  map: Map<string, RecipeReviewStats>,
  recipeId: string
): RecipeReviewStats {
  return map.get(recipeId) ?? EMPTY_REVIEW_STATS;
}
