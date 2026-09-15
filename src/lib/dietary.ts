/**
 * Dietary prefs + recipe eligibility helpers.
 *
 * Kosher/Halal flags mean “would be kosher/halal if prepared with certified
 * ingredients” — not a rabbinic or certifying-body claim.
 *
 * Plant prefs priority (mutually exclusive primary): vegan > vegetarian > pescatarian.
 * Vegan implies vegetarian for display; pescatarian is incompatible with vegan/vegetarian.
 */

export type DietaryUserPrefs = {
  isJewish?: boolean | null;
  isObservant?: boolean | null;
  preferKosher?: boolean | null;
  preferHalal?: boolean | null;
  preferVegetarian?: boolean | null;
  preferPescatarian?: boolean | null;
  preferVegan?: boolean | null;
};

export type DietarySuggestOptions = {
  /** Soft-boost kosherEligible (Jewish non-observant and/or preferKosher). */
  softPreferKosher?: boolean;
  /** Hard-filter to kosherEligible only (Jewish + observant). */
  requireKosher?: boolean;
  /** Hard-filter to halalEligible only (preferHalal). */
  requireHalal?: boolean;
  /** Hard-filter veganEligible OR veganAdaptNote (preferVegan). */
  requireVegan?: boolean;
  /** Hard-filter vegetarianEligible OR vegetarianAdaptNote. */
  requireVegetarian?: boolean;
  /** Hard-filter pescatarianEligible. */
  requirePescatarian?: boolean;
  softPreferVegan?: boolean;
  softPreferVegetarian?: boolean;
  softPreferPescatarian?: boolean;
};

export type PlantDiet = "vegan" | "vegetarian" | "pescatarian" | null;

export const DIETARY_BADGE_FOOTNOTE =
  "If you use kosher/halal ingredients";

export const PLANT_PREF_HELP =
  "Priority: vegan > vegetarian > pescatarian (one primary). Vegan implies vegetarian. Lists prefer matching recipes; non-matching may still appear when an adapt note exists.";

/** Observant is only meaningful when Jewish; otherwise treat as off. */
export function effectiveObservant(prefs: DietaryUserPrefs): boolean {
  return Boolean(prefs.isJewish) && Boolean(prefs.isObservant);
}

/**
 * Normalize plant prefs to a single primary diet.
 * Priority: vegan > vegetarian > pescatarian.
 */
export function normalizePlantPrefs(prefs: {
  preferVegan?: boolean | null;
  preferVegetarian?: boolean | null;
  preferPescatarian?: boolean | null;
}): {
  preferVegan: boolean;
  preferVegetarian: boolean;
  preferPescatarian: boolean;
  primary: PlantDiet;
} {
  if (prefs.preferVegan) {
    return {
      preferVegan: true,
      preferVegetarian: true, // implied
      preferPescatarian: false,
      primary: "vegan",
    };
  }
  if (prefs.preferVegetarian) {
    return {
      preferVegan: false,
      preferVegetarian: true,
      preferPescatarian: false,
      primary: "vegetarian",
    };
  }
  if (prefs.preferPescatarian) {
    return {
      preferVegan: false,
      preferVegetarian: false,
      preferPescatarian: true,
      primary: "pescatarian",
    };
  }
  return {
    preferVegan: false,
    preferVegetarian: false,
    preferPescatarian: false,
    primary: null,
  };
}

/** Apply a single plant-pref toggle with exclusivity + vegan⇒vegetarian implication. */
export function applyPlantPrefToggle(
  current: {
    preferVegan?: boolean | null;
    preferVegetarian?: boolean | null;
    preferPescatarian?: boolean | null;
  },
  key: "preferVegan" | "preferVegetarian" | "preferPescatarian",
  checked: boolean
): {
  preferVegan: boolean;
  preferVegetarian: boolean;
  preferPescatarian: boolean;
} {
  if (!checked) {
    const next = {
      preferVegan: Boolean(current.preferVegan),
      preferVegetarian: Boolean(current.preferVegetarian),
      preferPescatarian: Boolean(current.preferPescatarian),
    };
    next[key] = false;
    // Turning off vegan: also clear implied vegetarian unless they want veg separately
    if (key === "preferVegan") {
      next.preferVegetarian = false;
    }
    const n = normalizePlantPrefs(next);
    return {
      preferVegan: n.preferVegan,
      preferVegetarian: n.preferVegetarian,
      preferPescatarian: n.preferPescatarian,
    };
  }
  let normalized;
  if (key === "preferVegan") {
    normalized = normalizePlantPrefs({ preferVegan: true });
  } else if (key === "preferVegetarian") {
    normalized = normalizePlantPrefs({ preferVegetarian: true });
  } else {
    normalized = normalizePlantPrefs({ preferPescatarian: true });
  }
  return {
    preferVegan: normalized.preferVegan,
    preferVegetarian: normalized.preferVegetarian,
    preferPescatarian: normalized.preferPescatarian,
  };
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
  const plant = normalizePlantPrefs(prefs);
  return {
    softPreferKosher,
    requireKosher: observant,
    requireHalal: Boolean(prefs.preferHalal),
    requireVegan: plant.primary === "vegan",
    requireVegetarian: plant.primary === "vegetarian",
    requirePescatarian: plant.primary === "pescatarian",
    softPreferVegan: plant.primary === "vegan",
    softPreferVegetarian: plant.primary === "vegetarian",
    softPreferPescatarian: plant.primary === "pescatarian",
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

export type RecipeDietaryFields = {
  kosherEligible?: boolean | null;
  halalEligible?: boolean | null;
  vegetarianEligible?: boolean | null;
  pescatarianEligible?: boolean | null;
  veganEligible?: boolean | null;
  veganAdaptNote?: string | null;
  vegetarianAdaptNote?: string | null;
};

export function hasAdaptNote(note: string | null | undefined): boolean {
  return Boolean(note && note.trim());
}

/** Pass plant hard-filter (eligible OR adapt-note path when vegan/vegetarian). */
export function passesPlantDietaryFilter(
  recipe: RecipeDietaryFields,
  options: DietarySuggestOptions
): boolean {
  if (options.requireVegan) {
    return (
      Boolean(recipe.veganEligible) || hasAdaptNote(recipe.veganAdaptNote)
    );
  }
  if (options.requireVegetarian) {
    return (
      Boolean(recipe.vegetarianEligible) ||
      hasAdaptNote(recipe.vegetarianAdaptNote)
    );
  }
  if (options.requirePescatarian) {
    return Boolean(recipe.pescatarianEligible);
  }
  return true;
}

export function plantSoftBoost(
  recipe: RecipeDietaryFields,
  options: DietarySuggestOptions
): number {
  let boost = 0;
  if (options.softPreferVegan && recipe.veganEligible) boost += VEGAN_SOFT_BOOST;
  else if (options.softPreferVegetarian && recipe.vegetarianEligible)
    boost += VEGETARIAN_SOFT_BOOST;
  else if (options.softPreferPescatarian && recipe.pescatarianEligible)
    boost += PESCATARIAN_SOFT_BOOST;
  // Smaller boost for adapt-path (still surfaced, prefer true eligible)
  if (
    options.softPreferVegan &&
    !recipe.veganEligible &&
    hasAdaptNote(recipe.veganAdaptNote)
  ) {
    boost += ADAPT_SOFT_BOOST;
  }
  if (
    options.softPreferVegetarian &&
    !recipe.vegetarianEligible &&
    hasAdaptNote(recipe.vegetarianAdaptNote)
  ) {
    boost += ADAPT_SOFT_BOOST;
  }
  return boost;
}

export type AdaptHint = {
  kind: "vegan" | "vegetarian";
  label: string;
  note: string;
};

/** Prominent adapt hint when recipe doesn't match primary plant pref. */
export function adaptHintForPrefs(
  recipe: RecipeDietaryFields,
  prefs: DietaryUserPrefs | null | undefined
): AdaptHint | null {
  if (!prefs) return null;
  const plant = normalizePlantPrefs(prefs);
  if (plant.primary === "vegan" && !recipe.veganEligible) {
    const note = recipe.veganAdaptNote?.trim();
    if (note) {
      return { kind: "vegan", label: "Make it vegan", note };
    }
  }
  if (plant.primary === "vegetarian" && !recipe.vegetarianEligible) {
    const note = recipe.vegetarianAdaptNote?.trim();
    if (note) {
      return { kind: "vegetarian", label: "Make it vegetarian", note };
    }
  }
  return null;
}

/** Eligibility match for dish-variant ranking. */
export function matchesPlantPreference(
  recipe: RecipeDietaryFields,
  prefs: DietaryUserPrefs | null | undefined
): boolean {
  if (!prefs) return true;
  const plant = normalizePlantPrefs(prefs);
  if (plant.primary === "vegan") return Boolean(recipe.veganEligible);
  if (plant.primary === "vegetarian") return Boolean(recipe.vegetarianEligible);
  if (plant.primary === "pescatarian") return Boolean(recipe.pescatarianEligible);
  return true;
}

const KOSHER_INELIGIBLE =
  /\b(pork|bacon|ham\b|prosciutto|pancetta|lard\b|pepperoni|salami|shellfish|shrimp|prawn|crab\b|lobster|clam\b|mussel|oyster|scallop|calamari|squid|octopus|crawfish|crayfish|eel\b)\b/i;

const HALAL_INELIGIBLE =
  /\b(pork|bacon|ham\b|prosciutto|pancetta|lard\b|pepperoni|salami|wine\b|red wine|white wine|beer\b|rum\b|whiskey|whisky|vodka|brandy|sherry|bourbon|champagne|mirin|sake\b|alcohol)\b/i;

const LAND_MEAT =
  /\b(beef|steak|ground beef|pork|bacon|ham\b|prosciutto|pancetta|lard\b|pepperoni|salami|chicken|turkey|duck|lamb|mutton|veal|venison|sausage|hot dog|meatball|pepperoni|chorizo|brisket|ribs|bacon|prosciutto|gelatin)\b/i;

const FISH_SEAFOOD =
  /\b(fish|salmon|tuna|cod|tilapia|trout|sardine|anchov|halibut|mahi|shrimp|prawn|crab\b|lobster|clam\b|mussel|oyster|scallop|calamari|squid|octopus|crawfish|crayfish|seafood|fish sauce)\b/i;

const ANIMAL_DAIRY_EGG =
  /\b(milk|butter|cheese|cream|yogurt|yoghurt|whey|casein|ghee|egg\b|eggs\b|mayonnaise|mayo\b|honey)\b/i;

function blobFromInput(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  ingredients?: { name: string }[] | string[] | null;
}): string {
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
  return parts.join(" \n ");
}

/**
 * Conservative seed/heuristic defaults only. Prefer admin overrides.
 * Returns eligibility assuming certified ingredients when not clearly banned.
 */
export function inferDietaryEligibility(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  ingredients?: { name: string }[] | string[] | null;
}): {
  kosherEligible: boolean;
  halalEligible: boolean;
  vegetarianEligible: boolean;
  pescatarianEligible: boolean;
  veganEligible: boolean;
} {
  const blob = blobFromInput(input);
  const kosherEligible = !KOSHER_INELIGIBLE.test(blob);
  const halalEligible = !HALAL_INELIGIBLE.test(blob);
  const hasLandMeat = LAND_MEAT.test(blob);
  const hasFish = FISH_SEAFOOD.test(blob);
  const hasAnimalDairyEgg = ANIMAL_DAIRY_EGG.test(blob);

  const vegetarianEligible = !hasLandMeat && !hasFish;
  const pescatarianEligible = !hasLandMeat;
  const veganEligible = vegetarianEligible && !hasAnimalDairyEgg;

  return {
    kosherEligible,
    halalEligible,
    vegetarianEligible,
    pescatarianEligible,
    veganEligible,
  };
}

/** Optional short adapt notes for staples that aren't fully plant-eligible. */
export function inferAdaptNotes(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  ingredients?: { name: string }[] | string[] | null;
}): { veganAdaptNote: string | null; vegetarianAdaptNote: string | null } {
  const blob = blobFromInput(input);
  const diet = inferDietaryEligibility(input);
  let veganAdaptNote: string | null = null;
  let vegetarianAdaptNote: string | null = null;

  if (!diet.veganEligible && diet.vegetarianEligible) {
    if (/\b(butter|cheese|cream|milk|yogurt|yoghurt)\b/i.test(blob)) {
      veganAdaptNote =
        "Swap dairy for plant butter/milk/cheese (or omit cheese).";
    } else if (/\begg\b|eggs\b|mayonnaise|mayo\b/i.test(blob)) {
      veganAdaptNote = "Use a flax egg, aquafaba, or vegan mayo instead of egg/mayo.";
    } else if (/\bhoney\b/i.test(blob)) {
      veganAdaptNote = "Replace honey with maple syrup or agave.";
    } else {
      veganAdaptNote = "Replace animal dairy/eggs with plant alternatives.";
    }
  } else if (!diet.vegetarianEligible) {
    if (LAND_MEAT.test(blob) && !FISH_SEAFOOD.test(blob)) {
      vegetarianAdaptNote =
        "Swap the meat for beans, tofu, mushrooms, or a plant-based crumble.";
      veganAdaptNote =
        "Swap the meat for beans/tofu/mushrooms and use plant dairy if needed.";
    } else if (FISH_SEAFOOD.test(blob)) {
      vegetarianAdaptNote =
        "Skip the seafood or swap for hearts of palm, chickpeas, or tofu.";
      veganAdaptNote =
        "Skip seafood; use hearts of palm, chickpeas, or tofu, and plant dairy.";
    }
  }

  return { veganAdaptNote, vegetarianAdaptNote };
}

export const KOSHER_SOFT_BOOST = 20;
export const VEGAN_SOFT_BOOST = 22;
export const VEGETARIAN_SOFT_BOOST = 18;
export const PESCATARIAN_SOFT_BOOST = 16;
export const ADAPT_SOFT_BOOST = 8;
