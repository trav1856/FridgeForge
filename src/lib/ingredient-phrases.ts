/**
 * Shared ingredient-text helpers for the allergen / dietary / taxonomy heuristics.
 * Client-safe (no fs).
 */

/**
 * Non-dairy compounds that contain a dairy word: peanut/almond/apple butter,
 * coconut/oat/soy milk, vegan cheese, cream of tartar, butternut squash, …
 */
export const NON_DAIRY_PHRASES =
  /\b(?:peanut|almond|cashew|sunflower(?: seed)?|nut|apple|cocoa|shea|vegan|plant[- ]based|dairy[- ]free|non[- ]dairy)\s+butter\b|\b(?:coconut|almond|oat|soy|rice|cashew|vegan|plant[- ]based|dairy[- ]free|non[- ]dairy)\s+(?:milk|cream|yogurt|yoghurt|cheese)\b|\bcream of tartar\b|\bbutternut\b/gi;

/** Blank out non-dairy compounds so `\bbutter\b` / `\bmilk\b` only see real dairy. */
export function stripNonDairyPhrases(text: string): string {
  return text.replace(NON_DAIRY_PHRASES, " ");
}
