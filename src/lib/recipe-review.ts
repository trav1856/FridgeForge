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
