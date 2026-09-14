import {
  formatCardRating,
  type RecipeReviewStats,
} from "@/lib/recipe-review";

type Props = {
  averageStars?: number | null;
  reviewCount?: number;
  className?: string;
};

/** Compact average for list/grid recipe cards. Omits when count is 0. */
export function RecipeCardRating({
  averageStars = null,
  reviewCount = 0,
  className = "",
}: Props) {
  const label = formatCardRating({
    averageStars,
    reviewCount,
  } satisfies RecipeReviewStats);
  if (!label) return null;
  return (
    <p
      className={`text-xs font-semibold text-ember-700 ${className}`.trim()}
      aria-label={
        reviewCount === 1
          ? `${Number(averageStars).toFixed(1)} stars from 1 review`
          : `${Number(averageStars).toFixed(1)} stars from ${reviewCount} reviews`
      }
    >
      {label}
    </p>
  );
}
