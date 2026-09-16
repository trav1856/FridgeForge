/**
 * Dietary prefs + recipe eligibility helpers.
 *
 * Kosher/Halal flags mean “would be kosher/halal if prepared with certified
 * ingredients” — not a rabbinic or certifying-body claim.
 *
 * Plant prefs priority (mutually exclusive primary): vegan > vegetarian > pescatarian.
 * Vegan implies vegetarian for display; pescatarian is incompatible with vegan/vegetarian.
 *
 * Macro / lifestyle prefs (carnivore, Atkins, low carb, low sugar, low sodium) stack with
 * Jewish/Muslim/Kosher/Halal and with each other. Carnivore is mutually exclusive with
 * plant prefs. Atkins does NOT auto-force preferLowCarb.
 */

export type DietaryUserPrefs = {
  isJewish?: boolean | null;
  isObservant?: boolean | null;
  preferKosher?: boolean | null;
  /** Soft prefer + show Halal; food prefs (preferHalal) superseded by kosher food. */
  isMuslim?: boolean | null;
  preferHalal?: boolean | null;
  preferVegetarian?: boolean | null;
  preferPescatarian?: boolean | null;
  preferVegan?: boolean | null;
  preferCarnivore?: boolean | null;
  preferAtkins?: boolean | null;
  preferLowCarb?: boolean | null;
  preferLowSugar?: boolean | null;
  preferLowSodium?: boolean | null;
};

export type DietarySuggestOptions = {
  /** Soft-boost kosherEligible (and smaller boost for kosherAdaptNote path). */
  softPreferKosher?: boolean;
  /** Hard-filter to kosherEligible OR kosherAdaptNote (Jewish + observant). */
  requireKosher?: boolean;
  /** Soft-boost satisfiesHalal (Muslim; suppressed while kosher food prefs active). */
  softPreferHalal?: boolean;
  /** Hard-filter to satisfiesHalal (preferHalal; suppressed while kosher food active). */
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
  /** Hard-filter carnivoreEligible (preferCarnivore). */
  requireCarnivore?: boolean;
  requireAtkins?: boolean;
  requireLowCarb?: boolean;
  requireLowSugar?: boolean;
  requireLowSodium?: boolean;
  softPreferCarnivore?: boolean;
  softPreferAtkins?: boolean;
  softPreferLowCarb?: boolean;
  softPreferLowSugar?: boolean;
  softPreferLowSodium?: boolean;
};

export type PlantDiet = "vegan" | "vegetarian" | "pescatarian" | null;

export const DIETARY_BADGE_FOOTNOTE =
  "If you use kosher/halal ingredients";

export const PLANT_PREF_HELP =
  "Priority: vegan > vegetarian > pescatarian (one primary). Vegan implies vegetarian. Lists prefer matching recipes; non-matching may still appear when an adapt note exists.";

export const MACRO_PREF_HELP =
  "Carnivore, Atkins, low carb, low sugar, and low sodium stack with each other and with religion/kosher/halal. Carnivore is incompatible with plant-based. Atkins does not auto-enable low carb.";

/** Observant is only meaningful when Jewish; otherwise treat as off. */
export function effectiveObservant(prefs: DietaryUserPrefs): boolean {
  return Boolean(prefs.isJewish) && Boolean(prefs.isObservant);
}

/**
 * Kosher food supersedes Halal food: preferKosher or Observant clears preferHalal.
 * Religion flags are independent — isJewish alone does not clear isMuslim/preferHalal;
 * isMuslim is never forced off by this helper (religion can remain checked).
 * Plant prefs are untouched (stack freely with Jewish/Muslim).
 */
export function kosherFoodActive(prefs: DietaryUserPrefs): boolean {
  return Boolean(prefs.preferKosher) || effectiveObservant(prefs);
}

export function applyKosherHalalSupersede(
  prefs: DietaryUserPrefs
): DietaryUserPrefs {
  if (!kosherFoodActive(prefs)) return prefs;
  return { ...prefs, preferHalal: false };
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

export type MacroPrefKey =
  | "preferCarnivore"
  | "preferAtkins"
  | "preferLowCarb"
  | "preferLowSugar"
  | "preferLowSodium";

/** Apply a single plant-pref toggle with exclusivity + vegan⇒vegetarian implication.
 *  Turning any plant primary on clears preferCarnivore. */
export function applyPlantPrefToggle(
  current: {
    preferVegan?: boolean | null;
    preferVegetarian?: boolean | null;
    preferPescatarian?: boolean | null;
    preferCarnivore?: boolean | null;
  },
  key: "preferVegan" | "preferVegetarian" | "preferPescatarian",
  checked: boolean
): {
  preferVegan: boolean;
  preferVegetarian: boolean;
  preferPescatarian: boolean;
  preferCarnivore: boolean;
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
      preferCarnivore: Boolean(current.preferCarnivore),
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
    preferCarnivore: false, // plant primary clears carnivore
  };
}

/**
 * Apply a macro/lifestyle pref toggle.
 * Turning carnivore on clears plant prefs; other macros stack freely (Atkins ≠ force low carb).
 */
export function applyMacroPrefToggle(
  current: DietaryUserPrefs,
  key: MacroPrefKey,
  checked: boolean
): {
  preferCarnivore: boolean;
  preferAtkins: boolean;
  preferLowCarb: boolean;
  preferLowSugar: boolean;
  preferLowSodium: boolean;
  preferVegan: boolean;
  preferVegetarian: boolean;
  preferPescatarian: boolean;
} {
  const next = {
    preferCarnivore: Boolean(current.preferCarnivore),
    preferAtkins: Boolean(current.preferAtkins),
    preferLowCarb: Boolean(current.preferLowCarb),
    preferLowSugar: Boolean(current.preferLowSugar),
    preferLowSodium: Boolean(current.preferLowSodium),
    preferVegan: Boolean(current.preferVegan),
    preferVegetarian: Boolean(current.preferVegetarian),
    preferPescatarian: Boolean(current.preferPescatarian),
  };
  next[key] = checked;
  if (key === "preferCarnivore" && checked) {
    next.preferVegan = false;
    next.preferVegetarian = false;
    next.preferPescatarian = false;
  }
  // If carnivore somehow still on with plant, plant wins when plant was already set
  // and we're only toggling a non-carnivore macro — leave as-is.
  return next;
}

export function resolveDietarySuggestOptions(
  prefs: DietaryUserPrefs | null | undefined
): DietarySuggestOptions {
  if (!prefs) return {};
  const effective = applyKosherHalalSupersede(prefs);
  const observant = effectiveObservant(effective);
  const kosherActive = kosherFoodActive(effective);
  const softPreferKosher =
    !observant &&
    (Boolean(effective.preferKosher) ||
      (Boolean(effective.isJewish) && !Boolean(effective.isObservant)));
  // Halal food path suppressed while kosher food prefs are active.
  // isMuslim (religion) may still be true; softPreferHalal is still off when kosher food is on.
  const softPreferHalal =
    !kosherActive &&
    Boolean(effective.isMuslim) &&
    !Boolean(effective.preferHalal);
  // Carnivore ↔ plant exclusivity: carnivore clears plant for filtering.
  const carnivore = Boolean(effective.preferCarnivore);
  const plant = carnivore
    ? {
        preferVegan: false,
        preferVegetarian: false,
        preferPescatarian: false,
        primary: null as PlantDiet,
      }
    : normalizePlantPrefs(effective);
  const preferAtkins = Boolean(effective.preferAtkins);
  const preferLowCarb = Boolean(effective.preferLowCarb);
  const preferLowSugar = Boolean(effective.preferLowSugar);
  const preferLowSodium = Boolean(effective.preferLowSodium);
  return {
    softPreferKosher,
    requireKosher: observant,
    softPreferHalal,
    requireHalal: !kosherActive && Boolean(effective.preferHalal),
    requireVegan: plant.primary === "vegan",
    requireVegetarian: plant.primary === "vegetarian",
    requirePescatarian: plant.primary === "pescatarian",
    softPreferVegan: plant.primary === "vegan",
    softPreferVegetarian: plant.primary === "vegetarian",
    softPreferPescatarian: plant.primary === "pescatarian",
    requireCarnivore: carnivore,
    requireAtkins: preferAtkins,
    requireLowCarb: preferLowCarb,
    requireLowSugar: preferLowSugar,
    requireLowSodium: preferLowSodium,
    softPreferCarnivore: carnivore,
    softPreferAtkins: preferAtkins,
    softPreferLowCarb: preferLowCarb,
    softPreferLowSugar: preferLowSugar,
    softPreferLowSodium: preferLowSodium,
  };
}

/** Show dedicated Kosher nav/section when Jewish and/or preferKosher. */
export function showKosherSection(prefs: DietaryUserPrefs | null | undefined): boolean {
  if (!prefs) return false;
  return Boolean(prefs.isJewish) || Boolean(prefs.preferKosher);
}

/** Show dedicated Halal nav/section when Muslim and/or preferHalal (not when kosher food active). */
export function showHalalSection(prefs: DietaryUserPrefs | null | undefined): boolean {
  if (!prefs) return false;
  if (kosherFoodActive(prefs)) return false; // kosher food covers / supersedes Halal food
  return Boolean(prefs.isMuslim) || Boolean(prefs.preferHalal);
}

export type RecipeDietaryFields = {
  kosherEligible?: boolean | null;
  halalEligible?: boolean | null;
  vegetarianEligible?: boolean | null;
  pescatarianEligible?: boolean | null;
  veganEligible?: boolean | null;
  carnivoreEligible?: boolean | null;
  atkinsEligible?: boolean | null;
  lowCarbEligible?: boolean | null;
  lowSugarEligible?: boolean | null;
  lowSodiumEligible?: boolean | null;
  kosherAdaptNote?: string | null;
  veganAdaptNote?: string | null;
  vegetarianAdaptNote?: string | null;
  /** Optional text used to detect alcohol for kosher-without-alcohol ⇒ halal. */
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  ingredients?: { name: string }[] | string[] | null;
  steps?: string[] | string | null;
};

export function hasAdaptNote(note: string | null | undefined): boolean {
  return Boolean(note && note.trim());
}

/** Kosher hard-filter / section match: eligible OR non-empty kosherAdaptNote. */
export function passesKosherDietaryFilter(recipe: RecipeDietaryFields): boolean {
  return (
    Boolean(recipe.kosherEligible) || hasAdaptNote(recipe.kosherAdaptNote)
  );
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

/** Hard-filter macro/lifestyle prefs (AND). Empty pool OK when none match. */
export function passesMacroDietaryFilter(
  recipe: RecipeDietaryFields,
  options: DietarySuggestOptions
): boolean {
  if (options.requireCarnivore && !recipe.carnivoreEligible) return false;
  if (options.requireAtkins && !recipe.atkinsEligible) return false;
  if (options.requireLowCarb && !recipe.lowCarbEligible) return false;
  if (options.requireLowSugar && !recipe.lowSugarEligible) return false;
  if (options.requireLowSodium && !recipe.lowSodiumEligible) return false;
  return true;
}

export function macroSoftBoost(
  recipe: RecipeDietaryFields,
  options: DietarySuggestOptions
): number {
  let boost = 0;
  if (options.softPreferCarnivore && recipe.carnivoreEligible)
    boost += CARNIVORE_SOFT_BOOST;
  if (options.softPreferAtkins && recipe.atkinsEligible)
    boost += ATKINS_SOFT_BOOST;
  if (options.softPreferLowCarb && recipe.lowCarbEligible)
    boost += LOW_CARB_SOFT_BOOST;
  if (options.softPreferLowSugar && recipe.lowSugarEligible)
    boost += LOW_SUGAR_SOFT_BOOST;
  if (options.softPreferLowSodium && recipe.lowSodiumEligible)
    boost += LOW_SODIUM_SOFT_BOOST;
  return boost;
}

export type AdaptHint = {
  kind: "vegan" | "vegetarian" | "kosher";
  label: string;
  note: string;
};

/**
 * Prominent adapt hint when recipe doesn't match active dietary prefs.
 * Plant (vegan/vegetarian) checked first; then Make it kosher when user has
 * kosher interest (preferKosher / Jewish / Observant) and a kosherAdaptNote.
 * Note: Jewish cuisine/origin ≠ kosherEligible — adapt notes are food guidance only.
 */
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
  const wantsKosher =
    Boolean(prefs.preferKosher) ||
    Boolean(prefs.isJewish) ||
    effectiveObservant(prefs);
  if (wantsKosher && !recipe.kosherEligible) {
    const note = recipe.kosherAdaptNote?.trim();
    if (note) {
      return { kind: "kosher", label: "Make it kosher", note };
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

/** Alcohol / intoxicants that block the kosher-without-alcohol ⇒ halal path. */
const ALCOHOL_IN_RECIPE =
  /\b(wine\b|red wine|white wine|beer\b|rum\b|whiskey|whisky|vodka|brandy|sherry|bourbon|champagne|mirin|sake\b|alcohol|liqueur|cognac|tequila|gin\b)\b/i;

const HALAL_INELIGIBLE =
  /\b(pork|bacon|ham\b|prosciutto|pancetta|lard\b|pepperoni|salami|wine\b|red wine|white wine|beer\b|rum\b|whiskey|whisky|vodka|brandy|sherry|bourbon|champagne|mirin|sake\b|alcohol)\b/i;

const LAND_MEAT =
  /\b(beef|steak|ground beef|pork|bacon|ham\b|prosciutto|pancetta|lard\b|pepperoni|salami|chicken|turkey|duck|lamb|mutton|veal|venison|sausage|hot dog|meatball|pepperoni|chorizo|brisket|ribs|bacon|prosciutto|gelatin)\b/i;

const FISH_SEAFOOD =
  /\b(fish|salmon|tuna|cod|tilapia|trout|sardine|anchov|halibut|mahi|shrimp|prawn|crab\b|lobster|clam\b|mussel|oyster|scallop|calamari|squid|octopus|crawfish|crayfish|seafood|fish sauce)\b/i;

const ANIMAL_DAIRY_EGG =
  /\b(milk|butter|cheese|cream|yogurt|yoghurt|whey|casein|ghee|egg\b|eggs\b|mayonnaise|mayo\b|honey)\b/i;

const EGG_ONLY =
  /\b(egg\b|eggs\b)\b/i;

/** Grains / legumes / starchy staples that typically break carnivore / Atkins / low-carb. */
const CARB_HEAVY =
  /\b(rice|pasta|noodle|bread|flour|tortilla|potato|oat|oatmeal|quinoa|bean|beans|lentil|chickpea|corn\b|sugar|honey|syrup|banana|apple|fruit|cereal|couscous|bulgur|bagel|bun\b|roll\b|cracker|waffle|pancake)\b/i;

const SUGAR_HEAVY =
  /\b(sugar|honey|syrup|maple|agave|candy|dessert|chocolate|sweetened|molasses|frosting|icing|caramel)\b/i;

const SODIUM_HEAVY =
  /\b(soy sauce|fish sauce|salted|cured|bacon|ham\b|prosciutto|salami|pepperoni|pickled|miso|bouillon|broth cube|msg\b|anchov)\b/i;

function blobFromInput(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  ingredients?: { name: string }[] | string[] | null;
  steps?: string[] | string | null;
}): string {
  const parts: string[] = [];
  if (input.title) parts.push(input.title);
  if (input.description) parts.push(input.description);
  if (typeof input.tags === "string") parts.push(input.tags);
  else if (Array.isArray(input.tags)) parts.push(...input.tags);
  if (typeof input.steps === "string") parts.push(input.steps);
  else if (Array.isArray(input.steps)) parts.push(...input.steps);
  if (Array.isArray(input.ingredients)) {
    for (const ing of input.ingredients) {
      parts.push(typeof ing === "string" ? ing : ing.name);
    }
  }
  return parts.join(" \n ");
}

/** True when recipe text mentions alcohol / intoxicants (wine, beer, liquor, etc.). */
export function recipeContainsAlcohol(recipe: RecipeDietaryFields): boolean {
  return ALCOHOL_IN_RECIPE.test(blobFromInput(recipe));
}

/**
 * Halal satisfaction for soft-prefer / hard-filter:
 * - halalEligible, OR
 * - kosherEligible and no alcohol (kosher without alcohol covers halal for this product).
 */
export function satisfiesHalal(recipe: RecipeDietaryFields): boolean {
  if (Boolean(recipe.halalEligible)) return true;
  if (Boolean(recipe.kosherEligible) && !recipeContainsAlcohol(recipe)) {
    return true;
  }
  return false;
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
  carnivoreEligible: boolean;
  atkinsEligible: boolean;
  lowCarbEligible: boolean;
  lowSugarEligible: boolean;
  lowSodiumEligible: boolean;
} {
  const blob = blobFromInput(input);
  const kosherEligible = !KOSHER_INELIGIBLE.test(blob);
  const halalEligible = !HALAL_INELIGIBLE.test(blob);
  const hasLandMeat = LAND_MEAT.test(blob);
  const hasFish = FISH_SEAFOOD.test(blob);
  const hasAnimalDairyEgg = ANIMAL_DAIRY_EGG.test(blob);
  const hasEgg = EGG_ONLY.test(blob);
  const hasCarbHeavy = CARB_HEAVY.test(blob);
  const hasSugarHeavy = SUGAR_HEAVY.test(blob);
  const hasSodiumHeavy = SODIUM_HEAVY.test(blob);

  const vegetarianEligible = !hasLandMeat && !hasFish;
  const pescatarianEligible = !hasLandMeat;
  const veganEligible = vegetarianEligible && !hasAnimalDairyEgg;

  // Light heuristics — admin overrides preferred.
  const hasAnimalProtein = hasLandMeat || hasFish || hasEgg;
  const carnivoreEligible = hasAnimalProtein && !hasCarbHeavy && !vegetarianEligible;
  // Atkins ≈ low-carb animal-forward; still independent filter flag from lowCarb.
  const lowCarbEligible = !hasCarbHeavy;
  const atkinsEligible = lowCarbEligible && (hasAnimalProtein || !veganEligible);
  const lowSugarEligible = !hasSugarHeavy;
  const lowSodiumEligible = !hasSodiumHeavy;

  return {
    kosherEligible,
    halalEligible,
    vegetarianEligible,
    pescatarianEligible,
    veganEligible,
    carnivoreEligible,
    atkinsEligible,
    lowCarbEligible,
    lowSugarEligible,
    lowSodiumEligible,
  };
}

/** Optional short adapt notes for staples that aren't fully plant-eligible. */
export function inferAdaptNotes(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  ingredients?: { name: string }[] | string[] | null;
}): {
  veganAdaptNote: string | null;
  vegetarianAdaptNote: string | null;
  kosherAdaptNote: string | null;
} {
  const blob = blobFromInput(input);
  const diet = inferDietaryEligibility(input);
  let veganAdaptNote: string | null = null;
  let vegetarianAdaptNote: string | null = null;
  let kosherAdaptNote: string | null = null;

  // Light kosher adapt heuristics (not cuisine/origin claims).
  if (!diet.kosherEligible) {
    if (/\b(pork|bacon|ham\b|prosciutto|pancetta|lard\b|pepperoni|salami)\b/i.test(blob)) {
      kosherAdaptNote =
        "Swap pork/bacon products for kosher-certified beef, turkey, or plant protein.";
    } else if (
      /\b(shellfish|shrimp|prawn|crab\b|lobster|clam\b|mussel|oyster|scallop|calamari|squid|octopus|crawfish|crayfish)\b/i.test(
        blob
      )
    ) {
      kosherAdaptNote =
        "Swap shellfish for a kosher fish (fins and scales) or a plant alternative.";
    } else {
      kosherAdaptNote =
        "Use kosher-certified ingredients and keep meat/dairy separate if needed.";
    }
  }

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

  return { veganAdaptNote, vegetarianAdaptNote, kosherAdaptNote };
}

export const KOSHER_SOFT_BOOST = 20;
export const HALAL_SOFT_BOOST = 20;
export const VEGAN_SOFT_BOOST = 22;
export const VEGETARIAN_SOFT_BOOST = 18;
export const PESCATARIAN_SOFT_BOOST = 16;
export const CARNIVORE_SOFT_BOOST = 18;
export const ATKINS_SOFT_BOOST = 14;
export const LOW_CARB_SOFT_BOOST = 14;
export const LOW_SUGAR_SOFT_BOOST = 12;
export const LOW_SODIUM_SOFT_BOOST = 12;
export const ADAPT_SOFT_BOOST = 8;
