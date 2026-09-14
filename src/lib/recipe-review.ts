export const REVIEW_BODY_MAX = 180;
export const REVIEW_STARS_MIN = 1;
export const REVIEW_STARS_MAX = 5;

export type ReviewValidationOk = { ok: true; stars: number; body: string };
export type ReviewValidationErr = { ok: false; error: string };
export type ReviewValidation = ReviewValidationOk | ReviewValidationErr;

/**
 * Validate recipe review stars (1–5) and body (≤180 chars).
 * Any signed-in user may post; this does not check auth/admin.
 */
export function validateRecipeReview(
  stars: unknown,
  body: unknown
): ReviewValidation {
  const n =
    typeof stars === "number"
      ? stars
      : typeof stars === "string" && stars.trim() !== ""
        ? Number(stars)
        : NaN;

  if (!Number.isInteger(n) || n < REVIEW_STARS_MIN || n > REVIEW_STARS_MAX) {
    return {
      ok: false,
      error: `Stars must be an integer from ${REVIEW_STARS_MIN} to ${REVIEW_STARS_MAX}`,
    };
  }

  const text = typeof body === "string" ? body.trim() : "";
  if (text.length > REVIEW_BODY_MAX) {
    return {
      ok: false,
      error: `Comment must be at most ${REVIEW_BODY_MAX} characters`,
    };
  }

  return { ok: true, stars: n, body: text };
}

export function reviewShareText(recipeTitle: string, stars: number): string {
  return `I rated "${recipeTitle}" ${stars}/5 on FridgeForge`;
}

export type RecipeReviewStats = {
  averageStars: number | null;
  reviewCount: number;
};

export const EMPTY_REVIEW_STATS: RecipeReviewStats = {
  averageStars: null,
  reviewCount: 0,
};

/** Round to one decimal for card display (e.g. 4.2). */
export function roundAverageStars(avg: number | null | undefined): number | null {
  if (avg == null || !Number.isFinite(avg)) return null;
  return Math.round(avg * 10) / 10;
}

/**
 * Card label when there is at least one rating, e.g. "4.2★ · 3".
 * Returns null when there are no reviews (omit clutter on cards).
 */
export function formatCardRating(stats: RecipeReviewStats): string | null {
  if (stats.reviewCount <= 0) return null;
  const avg = roundAverageStars(stats.averageStars);
  if (avg == null) return null;
  const count = stats.reviewCount;
  return `${avg.toFixed(1)}★ · ${count}`;
}
