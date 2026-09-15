/**
 * Kosher / Halal dietary prefs + recipe eligibility helpers.
 *
 * Recipe flags mean “would be kosher/halal if prepared with certified
 * ingredients” — not a rabbinic or certifying-body claim.
 */

export type DietaryUserPrefs = {
  isJewish?: boolean | null;
  isObservant?: boolean | null;
  preferKosher?: boolean | null;
  preferHalal?: boolean | null;
};

export type DietarySuggestOptions = {
  /** Soft-boost kosherEligible (Jewish non-observant and/or preferKosher). */
  softPreferKosher?: boolean;
  /** Hard-filter to kosherEligible only (Jewish + observant). */
  requireKosher?: boolean;
  /** Hard-filter to halalEligible only (preferHalal). */
  requireHalal?: boolean;
};

export const DIETARY_BADGE_FOOTNOTE =
  "If you use kosher/halal ingredients";

/** Observant is only meaningful when Jewish; otherwise treat as off. */
export function effectiveObservant(prefs: DietaryUserPrefs): boolean {
  return Boolean(prefs.isJewish) && Boolean(prefs.isObservant);
}

export function resolveDietarySuggestOptions(
  prefs: DietaryUserPrefs | null | undefined
): DietarySuggestOptions {
  if (!prefs) return {};
  const observant = effectiveObservant(prefs);
  const softPreferKosher =
    !observant &&
    (Boolean(prefs.preferKosher) ||
      (Boolean(prefs.isJewish) && !Boolean(prefs.isObservant)));
  return {
    softPreferKosher,
    requireKosher: observant,
    requireHalal: Boolean(prefs.preferHalal),
  };
}

/** Show dedicated Kosher nav/section when Jewish and/or preferKosher. */
export function showKosherSection(prefs: DietaryUserPrefs | null | undefined): boolean {
  if (!prefs) return false;
  return Boolean(prefs.isJewish) || Boolean(prefs.preferKosher);
}

/** Show dedicated Halal nav/section when preferHalal. */
export function showHalalSection(prefs: DietaryUserPrefs | null | undefined): boolean {
  if (!prefs) return false;
  return Boolean(prefs.preferHalal);
}

const KOSHER_INELIGIBLE =
  /\b(pork|bacon|ham\b|prosciutto|pancetta|lard\b|pepperoni|salami|shellfish|shrimp|prawn|crab\b|lobster|clam\b|mussel|oyster|scallop|calamari|squid|octopus|crawfish|crayfish|eel\b)\b/i;

const HALAL_INELIGIBLE =
  /\b(pork|bacon|ham\b|prosciutto|pancetta|lard\b|pepperoni|salami|wine\b|red wine|white wine|beer\b|rum\b|whiskey|whisky|vodka|brandy|sherry|bourbon|champagne|mirin|sake\b|alcohol)\b/i;

/**
 * Conservative seed/heuristic defaults only. Prefer admin overrides.
 * Returns eligibility assuming certified ingredients when not clearly banned.
 */
export function inferDietaryEligibility(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  ingredients?: { name: string }[] | string[] | null;
}): { kosherEligible: boolean; halalEligible: boolean } {
  const parts: string[] = [];
  if (input.title) parts.push(input.title);
  if (input.description) parts.push(input.description);
  if (typeof input.tags === "string") parts.push(input.tags);
  else if (Array.isArray(input.tags)) parts.push(...input.tags);
  if (Array.isArray(input.ingredients)) {
    for (const ing of input.ingredients) {
      parts.push(typeof ing === "string" ? ing : ing.name);
    }
  }
  const blob = parts.join(" \n ");
  const kosherEligible = !KOSHER_INELIGIBLE.test(blob);
  const halalEligible = !HALAL_INELIGIBLE.test(blob);
  return { kosherEligible, halalEligible };
}

export const KOSHER_SOFT_BOOST = 20;
