import { describe, expect, it } from "vitest";
import {
  adaptHintForPrefs,
  applyKosherHalalSupersede,
  kosherFoodActive,
  applyMacroPrefToggle,
  applyPlantPrefToggle,
  dietConflictPills,
  effectiveObservant,
  inferAdaptNotes,
  inferDietaryEligibility,
  normalizePlantPrefs,
  passesMacroDietaryFilter,
  passesPlantDietaryFilter,
  pickSimilarEligibleRecipes,
  recipeContainsAlcohol,
  resolveDietarySuggestOptions,
  satisfiesHalal,
  showHalalSection,
  showKosherSection,
} from "@/lib/dietary";
import {
  conflictingAllergens,
  inferAllergenTags,
  hasAllergenConflict,
} from "@/lib/allergens";
import { scoreRecipe, suggestMeals } from "@/lib/suggestions";
import type { PantrySnapshot, RecipeForMatch } from "@/lib/types";

const pantry = (names: string[]): PantrySnapshot[] =>
  names.map((name, i) => ({
    id: `p${i}`,
    name,
    quantity: 1,
    unit: "each",
    category: null,
    tags: [],
  }));

const recipe = (
  partial: Partial<RecipeForMatch> & {
    title: string;
    ingredients: RecipeForMatch["ingredients"];
  }
): RecipeForMatch => ({
  id: partial.id || "r1",
  title: partial.title,
  description: partial.description ?? null,
  steps: partial.steps ?? ["Cook"],
  costTier: partial.costTier ?? "cheap",
  tags: partial.tags ?? [],
  servings: partial.servings ?? 2,
  cookTimeMinutes: partial.cookTimeMinutes ?? null,
  isStruggleMeal: partial.isStruggleMeal ?? false,
  kosherEligible: partial.kosherEligible ?? false,
  halalEligible: partial.halalEligible ?? false,
  vegetarianEligible: partial.vegetarianEligible ?? false,
  pescatarianEligible: partial.pescatarianEligible ?? false,
  veganEligible: partial.veganEligible ?? false,
  carnivoreEligible: partial.carnivoreEligible ?? false,
  atkinsEligible: partial.atkinsEligible ?? false,
  lowCarbEligible: partial.lowCarbEligible ?? false,
  lowSugarEligible: partial.lowSugarEligible ?? false,
  lowSodiumEligible: partial.lowSodiumEligible ?? false,
  kosherAdaptNote: partial.kosherAdaptNote ?? null,
  halalAdaptNote: partial.halalAdaptNote ?? null,
  veganAdaptNote: partial.veganAdaptNote ?? null,
  vegetarianAdaptNote: partial.vegetarianAdaptNote ?? null,
  allergenTags: partial.allergenTags ?? [],
  techniqueTips: partial.techniqueTips ?? [],
  flavorBoosters: partial.flavorBoosters ?? [],
  ingredients: partial.ingredients,
});

describe("dietary prefs resolve", () => {
  it("treats observant without Jewish as off", () => {
    expect(effectiveObservant({ isJewish: false, isObservant: true })).toBe(
      false
    );
    expect(effectiveObservant({ isJewish: true, isObservant: true })).toBe(
      true
    );
  });

  it("soft-boosts when Jewish non-observant or preferKosher", () => {
    expect(
      resolveDietarySuggestOptions({
        isJewish: true,
        isObservant: false,
      })
    ).toMatchObject({
      softPreferKosher: true,
      requireKosher: false,
      requireHalal: false,
    });
    expect(
      resolveDietarySuggestOptions({ preferKosher: true })
    ).toMatchObject({ softPreferKosher: true, requireKosher: false });
  });

  it("soft-boosts kosher when observant Jewish (no hard-filter)", () => {
    expect(
      resolveDietarySuggestOptions({ isJewish: true, isObservant: true })
    ).toMatchObject({
      softPreferKosher: true,
      requireKosher: false,
      requireHalal: false,
    });
  });

  it("soft-boosts halal when preferHalal (no hard-filter)", () => {
    expect(resolveDietarySuggestOptions({ preferHalal: true })).toMatchObject({
      softPreferKosher: false,
      requireKosher: false,
      softPreferHalal: true,
      requireHalal: false,
    });
  });

  it("Observant (kosher food) supersedes preferHalal; Muslim religion can remain", () => {
    expect(
      resolveDietarySuggestOptions({
        isJewish: true,
        isObservant: true,
        preferHalal: true,
        isMuslim: true,
      })
    ).toMatchObject({
      softPreferKosher: true,
      requireKosher: false,
      softPreferHalal: false,
      requireHalal: false,
    });
  });

  it("preferKosher supersedes preferHalal soft/hard paths", () => {
    expect(
      resolveDietarySuggestOptions({
        preferKosher: true,
        preferHalal: true,
        isMuslim: true,
      })
    ).toMatchObject({
      softPreferKosher: true,
      softPreferHalal: false,
      requireHalal: false,
    });
  });

  it("isJewish alone does NOT suppress Halal soft-prefer", () => {
    expect(
      resolveDietarySuggestOptions({
        isJewish: true,
        isObservant: false,
        isMuslim: true,
        preferHalal: false,
      })
    ).toMatchObject({
      softPreferKosher: true,
      softPreferHalal: true,
      requireHalal: false,
    });
  });

  it("soft-prefers halal when Muslim or Prefer Halal", () => {
    expect(resolveDietarySuggestOptions({ isMuslim: true })).toMatchObject({
      softPreferHalal: true,
      requireHalal: false,
    });
    expect(
      resolveDietarySuggestOptions({ isMuslim: true, preferHalal: true })
    ).toMatchObject({
      softPreferHalal: true,
      requireHalal: false,
    });
  });

  it("stacks Jewish or Muslim with plant prefs", () => {
    expect(
      resolveDietarySuggestOptions({ isJewish: true, preferVegan: true })
    ).toMatchObject({
      softPreferKosher: true,
      requireVegan: true,
      softPreferVegan: true,
    });
    expect(
      resolveDietarySuggestOptions({ isMuslim: true, preferVegetarian: true })
    ).toMatchObject({
      softPreferHalal: true,
      requireVegetarian: true,
      softPreferVegetarian: true,
    });
  });

  it("applyKosherHalalSupersede clears preferHalal for kosher food, leaves isMuslim", () => {
    expect(
      applyKosherHalalSupersede({
        preferKosher: true,
        isMuslim: true,
        preferHalal: true,
      })
    ).toMatchObject({ isMuslim: true, preferHalal: false, preferKosher: true });
    expect(
      applyKosherHalalSupersede({
        isJewish: true,
        isObservant: true,
        isMuslim: true,
        preferHalal: true,
      })
    ).toMatchObject({ isMuslim: true, preferHalal: false });
    // Jewish alone does not clear Halal food prefs
    expect(
      applyKosherHalalSupersede({
        isJewish: true,
        isMuslim: true,
        preferHalal: true,
      })
    ).toMatchObject({ isMuslim: true, preferHalal: true, isJewish: true });
    expect(kosherFoodActive({ isJewish: true })).toBe(false);
    expect(kosherFoodActive({ preferKosher: true })).toBe(true);
    expect(
      applyKosherHalalSupersede({ isMuslim: true, preferHalal: true })
    ).toMatchObject({ isMuslim: true, preferHalal: true });
  });

  it("personal chrome flags (not public nav silos)", () => {
    expect(showKosherSection({ isJewish: true })).toBe(true);
    expect(showKosherSection({ preferKosher: true })).toBe(true);
    expect(showKosherSection({ isJewish: true, isObservant: true })).toBe(true);
    expect(showKosherSection({})).toBe(false);
    expect(showHalalSection({ preferHalal: true })).toBe(true);
    expect(showHalalSection({ isMuslim: true })).toBe(true);
    expect(showHalalSection({})).toBe(false);
    // Jewish alone does not hide Halal section
    expect(
      showHalalSection({ isJewish: true, isMuslim: true, preferHalal: true })
    ).toBe(true);
    // Kosher food prefs hide Halal section
    expect(
      showHalalSection({ preferKosher: true, isMuslim: true, preferHalal: true })
    ).toBe(false);
    expect(
      showHalalSection({
        isJewish: true,
        isObservant: true,
        isMuslim: true,
        preferHalal: true,
      })
    ).toBe(false);
  });
});

describe("satisfiesHalal", () => {
  it("accepts halalEligible", () => {
    expect(satisfiesHalal({ halalEligible: true, kosherEligible: false })).toBe(
      true
    );
  });

  it("accepts kosherEligible without alcohol", () => {
    expect(
      satisfiesHalal({
        halalEligible: false,
        kosherEligible: true,
        title: "Chicken Rice",
        ingredients: [{ name: "chicken" }, { name: "rice" }],
      })
    ).toBe(true);
  });

  it("rejects kosherEligible with alcohol", () => {
    expect(
      satisfiesHalal({
        halalEligible: false,
        kosherEligible: true,
        title: "Wine Braised Chicken",
        ingredients: [{ name: "chicken" }, { name: "red wine" }],
      })
    ).toBe(false);
    expect(
      recipeContainsAlcohol({
        title: "Wine Braised Chicken",
        ingredients: [{ name: "red wine" }],
      })
    ).toBe(true);
  });

  it("rejects neither flag", () => {
    expect(
      satisfiesHalal({
        halalEligible: false,
        kosherEligible: false,
        title: "Bacon",
      })
    ).toBe(false);
  });
});

describe("plant prefs priority", () => {
  it("normalizes vegan > vegetarian > pescatarian", () => {
    expect(normalizePlantPrefs({ preferVegan: true, preferPescatarian: true })).toEqual({
      preferVegan: true,
      preferVegetarian: true,
      preferPescatarian: false,
      primary: "vegan",
    });
    expect(normalizePlantPrefs({ preferVegetarian: true, preferPescatarian: true })).toEqual({
      preferVegan: false,
      preferVegetarian: true,
      preferPescatarian: false,
      primary: "vegetarian",
    });
  });

  it("applyPlantPrefToggle enforces exclusivity", () => {
    expect(applyPlantPrefToggle({}, "preferVegan", true)).toEqual({
      preferVegan: true,
      preferVegetarian: true,
      preferPescatarian: false,
      preferCarnivore: false,
    });
    expect(
      applyPlantPrefToggle({ preferVegan: true }, "preferPescatarian", true)
    ).toEqual({
      preferVegan: false,
      preferVegetarian: false,
      preferPescatarian: true,
      preferCarnivore: false,
    });
  });

  it("resolveDietarySuggestOptions sets plant require flags", () => {
    expect(resolveDietarySuggestOptions({ preferVegan: true })).toMatchObject({
      requireVegan: true,
      softPreferVegan: true,
      requireVegetarian: false,
      requirePescatarian: false,
    });
    expect(
      resolveDietarySuggestOptions({ preferVegetarian: true })
    ).toMatchObject({
      requireVegetarian: true,
      softPreferVegetarian: true,
      requireVegan: false,
    });
  });
});

describe("inferDietaryEligibility heuristics", () => {
  it("marks vegetarian staples eligible for plant + kosher/halal", () => {
    const r = inferDietaryEligibility({
      title: "Rice and Beans",
      ingredients: [{ name: "rice" }, { name: "black beans" }],
    });
    expect(r).toMatchObject({
      kosherEligible: true,
      halalEligible: true,
      vegetarianEligible: true,
      pescatarianEligible: true,
      veganEligible: true,
      carnivoreEligible: false,
      lowCarbEligible: false, // rice/beans are carb-heavy
      lowSugarEligible: true,
    });
  });

  it("excludes pork from kosher and halal", () => {
    const r = inferDietaryEligibility({
      title: "BLT",
      ingredients: [{ name: "bacon" }, { name: "bread" }],
    });
    expect(r.kosherEligible).toBe(false);
    expect(r.halalEligible).toBe(false);
    expect(r.vegetarianEligible).toBe(false);
    expect(r.veganEligible).toBe(false);
    expect(r.pescatarianEligible).toBe(false);
  });

  it("excludes shellfish from kosher but not necessarily alcohol rules", () => {
    const r = inferDietaryEligibility({
      title: "Shrimp Pasta",
      ingredients: [{ name: "shrimp" }, { name: "pasta" }],
    });
    expect(r.kosherEligible).toBe(false);
    expect(r.halalEligible).toBe(true);
    expect(r.vegetarianEligible).toBe(false);
    expect(r.pescatarianEligible).toBe(true);
    expect(r.veganEligible).toBe(false);
  });

  it("excludes alcohol-heavy from halal", () => {
    const r = inferDietaryEligibility({
      title: "Wine Sauce Chicken",
      ingredients: [{ name: "chicken" }, { name: "red wine" }],
    });
    expect(r.halalEligible).toBe(false);
    expect(r.kosherEligible).toBe(true);
  });

  it("dairy is vegetarian but not vegan", () => {
    const r = inferDietaryEligibility({
      title: "Mac and Cheese",
      ingredients: [{ name: "pasta" }, { name: "cheese" }, { name: "butter" }],
    });
    expect(r.vegetarianEligible).toBe(true);
    expect(r.veganEligible).toBe(false);
    expect(r.pescatarianEligible).toBe(true);
  });

  it("infers vegan adapt note for dairy dishes", () => {
    const notes = inferAdaptNotes({
      title: "Mac and Cheese",
      ingredients: [{ name: "pasta" }, { name: "cheese" }],
    });
    expect(notes.veganAdaptNote).toMatch(/plant/i);
  });

  it("infers kosher adapt note for pork/shellfish (not a cuisine claim)", () => {
    const pork = inferAdaptNotes({
      title: "BLT",
      ingredients: [{ name: "bacon" }, { name: "bread" }],
    });
    expect(pork.kosherAdaptNote).toMatch(/pork|bacon|kosher/i);
    const shrimp = inferAdaptNotes({
      title: "Shrimp Pasta",
      ingredients: [{ name: "shrimp" }, { name: "pasta" }],
    });
    expect(shrimp.kosherAdaptNote).toMatch(/shellfish|kosher fish/i);
    const rice = inferAdaptNotes({
      title: "Rice and Beans",
      ingredients: [{ name: "rice" }, { name: "beans" }],
    });
    expect(rice.kosherAdaptNote).toBeNull();
  });
});

describe("suggestMeals dietary filters/boost", () => {
  const kosher = recipe({
    id: "k",
    title: "Kosher Rice",
    kosherEligible: true,
    halalEligible: true,
    vegetarianEligible: true,
    pescatarianEligible: true,
    veganEligible: true,
    ingredients: [
      { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
    ],
  });
  const treyf = recipe({
    id: "t",
    title: "Bacon Pasta",
    kosherEligible: false,
    halalEligible: false,
    ingredients: [
      { id: "1", name: "pasta", quantity: 1, unit: "cups", optional: false },
    ],
  });
  const halalOnly = recipe({
    id: "h",
    title: "Shrimp Bowl",
    kosherEligible: false,
    halalEligible: true,
    pescatarianEligible: true,
    ingredients: [
      { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
    ],
  });
  const dairyVeg = recipe({
    id: "d",
    title: "Cheese Pasta",
    vegetarianEligible: true,
    pescatarianEligible: true,
    veganEligible: false,
    veganAdaptNote: "Use vegan cheese",
    ingredients: [
      { id: "1", name: "pasta", quantity: 1, unit: "cups", optional: false },
    ],
  });
  const meatOnly = recipe({
    id: "m",
    title: "Chicken Bowl",
    vegetarianEligible: false,
    pescatarianEligible: false,
    veganEligible: false,
    vegetarianAdaptNote: "Swap chicken for chickpeas",
    veganAdaptNote: "Swap chicken for tofu",
    ingredients: [
      { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
    ],
  });
  const stock = pantry(["rice", "pasta"]);

  it("soft-boosts kosherEligible when softPreferKosher", () => {
    const boosted = scoreRecipe(kosher, stock, { softPreferKosher: true });
    const plain = scoreRecipe(kosher, stock, {});
    expect(boosted.dietaryBoost).toBeGreaterThan(0);
    expect(boosted.score).toBeGreaterThan(plain.score);
  });

  it("soft-boosts satisfiesHalal when softPreferHalal", () => {
    const kosherNoAlcohol = recipe({
      id: "kna",
      title: "Kosher Chicken",
      kosherEligible: true,
      halalEligible: false,
      ingredients: [
        { id: "1", name: "chicken", quantity: 1, unit: "lb", optional: false },
        { id: "2", name: "rice", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const boosted = scoreRecipe(kosherNoAlcohol, stock, {
      softPreferHalal: true,
    });
    const plain = scoreRecipe(kosherNoAlcohol, stock, {});
    expect(boosted.dietaryBoost).toBeGreaterThan(0);
    expect(boosted.score).toBeGreaterThan(plain.score);

    const wineKosher = recipe({
      id: "wk",
      title: "Wine Chicken",
      kosherEligible: true,
      halalEligible: false,
      ingredients: [
        { id: "1", name: "chicken", quantity: 1, unit: "lb", optional: false },
        { id: "2", name: "red wine", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const wineBoosted = scoreRecipe(wineKosher, stock, {
      softPreferHalal: true,
    });
    expect(wineBoosted.dietaryBoost).toBe(0);
  });

  it("does not hard-filter kosher; soft-boost ranks eligible higher", () => {
    const results = suggestMeals([kosher, treyf, halalOnly], stock, {
      softPreferKosher: true,
    });
    const ids = results.map((r) => r.recipe.id);
    expect(ids).toContain("k");
    expect(ids).toContain("t"); // non-eligible still shown
    expect(ids.indexOf("k")).toBeLessThan(ids.indexOf("t"));
  });

  it("soft-boosts kosherAdaptNote less than kosherEligible", () => {
    const adaptOnly = recipe({
      id: "ka",
      title: "Adapt Pasta",
      kosherEligible: false,
      kosherAdaptNote: "Use kosher sausage",
      ingredients: [
        { id: "1", name: "pasta", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const eligibleBoost = scoreRecipe(kosher, stock, { softPreferKosher: true });
    const adaptBoost = scoreRecipe(adaptOnly, stock, { softPreferKosher: true });
    const plain = scoreRecipe(adaptOnly, stock, {});
    expect(adaptBoost.dietaryBoost).toBeGreaterThan(0);
    expect(adaptBoost.score).toBeGreaterThan(plain.score);
    expect(eligibleBoost.dietaryBoost).toBeGreaterThan(adaptBoost.dietaryBoost);
  });

  it("does not hard-filter Prefer Halal; soft-boost ranks satisfiesHalal higher", () => {
    const kosherNoAlcohol = recipe({
      id: "kna",
      title: "Kosher Chicken",
      kosherEligible: true,
      halalEligible: false,
      ingredients: [
        { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const wineKosher = recipe({
      id: "wk",
      title: "Wine Chicken",
      kosherEligible: true,
      halalEligible: false,
      ingredients: [
        { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
        { id: "2", name: "wine", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const results = suggestMeals(
      [kosher, treyf, halalOnly, kosherNoAlcohol, wineKosher],
      stock,
      { softPreferHalal: true }
    );
    const ids = results.map((r) => r.recipe.id);
    expect(ids).toContain("t"); // non-halal still shown
    expect(ids).toContain("wk");
    expect(ids.indexOf("h")).toBeLessThan(ids.indexOf("wk"));
  });

  it("Observant soft-boost does not empty the pool", () => {
    const opts = resolveDietarySuggestOptions({
      isJewish: true,
      isObservant: true,
    });
    expect(opts.requireKosher).toBe(false);
    expect(opts.softPreferKosher).toBe(true);
    const results = suggestMeals([kosher, treyf, halalOnly], stock, opts);
    expect(results.length).toBe(3);
  });

  it("Prefer Halal soft-boost does not empty the pool", () => {
    const opts = resolveDietarySuggestOptions({ preferHalal: true });
    expect(opts.requireHalal).toBe(false);
    expect(opts.softPreferHalal).toBe(true);
    const results = suggestMeals([kosher, treyf, halalOnly], stock, opts);
    expect(results.length).toBe(3);
  });

  it("struggle mode still hard-filters struggle meals; kosher soft-boost only", () => {
    const struggleKosher = recipe({
      id: "sk",
      title: "Struggle Kosher",
      isStruggleMeal: true,
      kosherEligible: true,
      ingredients: [
        { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const struggleTreyf = recipe({
      id: "st",
      title: "Struggle Bacon",
      isStruggleMeal: true,
      kosherEligible: false,
      ingredients: [
        { id: "1", name: "pasta", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const fancyKosher = recipe({
      id: "fk",
      title: "Fancy Kosher",
      isStruggleMeal: false,
      kosherEligible: true,
      ingredients: [
        { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const results = suggestMeals(
      [struggleKosher, struggleTreyf, fancyKosher],
      stock,
      { struggleMode: true, softPreferKosher: true }
    );
    expect(results.map((r) => r.recipe.id).sort()).toEqual(["sk", "st"]);
    expect(results[0]!.recipe.id).toBe("sk");
  });

  it("preferVegan hard-filters eligible OR adapt note", () => {
    expect(
      passesPlantDietaryFilter(dairyVeg, { requireVegan: true })
    ).toBe(true);
    expect(
      passesPlantDietaryFilter(meatOnly, { requireVegan: true })
    ).toBe(true);
    expect(
      passesPlantDietaryFilter(treyf, { requireVegan: true })
    ).toBe(false);

    const results = suggestMeals([kosher, dairyVeg, meatOnly, treyf], stock, {
      requireVegan: true,
      softPreferVegan: true,
    });
    const ids = results.map((r) => r.recipe.id);
    expect(ids).toContain("k");
    expect(ids).toContain("d");
    expect(ids).toContain("m");
    expect(ids).not.toContain("t");
    // true vegan ranks above adapt-only
    expect(ids.indexOf("k")).toBeLessThan(ids.indexOf("d"));
  });

  it("preferVegetarian includes adapt path", () => {
    const results = suggestMeals([kosher, meatOnly, treyf], stock, {
      requireVegetarian: true,
    });
    expect(results.map((r) => r.recipe.id).sort()).toEqual(["k", "m"]);
  });

  it("preferPescatarian hard-filters pescatarianEligible only", () => {
    const results = suggestMeals([kosher, halalOnly, meatOnly], stock, {
      requirePescatarian: true,
    });
    expect(results.map((r) => r.recipe.id).sort()).toEqual(["h", "k"]);
  });
});

describe("adapt hints", () => {
  it("shows vegan adapt when preferVegan and not eligible", () => {
    const hint = adaptHintForPrefs(
      {
        veganEligible: false,
        veganAdaptNote: "Use oat milk",
      },
      { preferVegan: true }
    );
    expect(hint).toEqual({
      kind: "vegan",
      label: "Make it vegan",
      note: "Use oat milk",
    });
  });

  it("hides hint when already veganEligible", () => {
    expect(
      adaptHintForPrefs(
        { veganEligible: true, veganAdaptNote: "n/a" },
        { preferVegan: true }
      )
    ).toBeNull();
  });

  it("shows Make it kosher when not kosherEligible but note + kosher prefs", () => {
    expect(
      adaptHintForPrefs(
        {
          kosherEligible: false,
          kosherAdaptNote: "Swap shrimp for kosher fish",
        },
        { preferKosher: true }
      )
    ).toEqual({
      kind: "kosher",
      label: "Make it kosher",
      note: "Swap shrimp for kosher fish",
    });
    expect(
      adaptHintForPrefs(
        {
          kosherEligible: false,
          kosherAdaptNote: "Swap shrimp for kosher fish",
        },
        { isJewish: true }
      )
    ).toMatchObject({ kind: "kosher", label: "Make it kosher" });
    // no kosher interest → no kosher hint
    expect(
      adaptHintForPrefs(
        {
          kosherEligible: false,
          kosherAdaptNote: "Swap shrimp for kosher fish",
        },
        { preferHalal: true }
      )
    ).toBeNull();
    // eligible → no hint
    expect(
      adaptHintForPrefs(
        { kosherEligible: true, kosherAdaptNote: "n/a" },
        { preferKosher: true }
      )
    ).toBeNull();
  });

  it("shows Make it halal when not satisfiesHalal but note + Halal prefs", () => {
    expect(
      adaptHintForPrefs(
        {
          kosherEligible: false,
          halalEligible: false,
          halalAdaptNote: "Omit wine; use stock",
          title: "Wine Chicken",
          ingredients: [{ name: "wine" }],
        },
        { preferHalal: true }
      )
    ).toEqual({
      kind: "halal",
      label: "Make it halal",
      note: "Omit wine; use stock",
    });
  });
});



describe("carnivore ↔ plant exclusivity", () => {
  it("turning carnivore on clears plant prefs", () => {
    expect(
      applyMacroPrefToggle(
        { preferVegan: true, preferVegetarian: true },
        "preferCarnivore",
        true
      )
    ).toMatchObject({
      preferCarnivore: true,
      preferVegan: false,
      preferVegetarian: false,
      preferPescatarian: false,
    });
  });

  it("turning plant on clears carnivore", () => {
    expect(
      applyPlantPrefToggle({ preferCarnivore: true }, "preferVegan", true)
    ).toEqual({
      preferVegan: true,
      preferVegetarian: true,
      preferPescatarian: false,
      preferCarnivore: false,
    });
  });

  it("Atkins does not auto-force preferLowCarb", () => {
    expect(
      resolveDietarySuggestOptions({ preferAtkins: true })
    ).toMatchObject({
      requireAtkins: true,
      requireLowCarb: false,
      softPreferAtkins: true,
      softPreferLowCarb: false,
    });
    expect(
      resolveDietarySuggestOptions({
        preferAtkins: true,
        preferLowCarb: true,
        preferLowSugar: true,
      })
    ).toMatchObject({
      requireAtkins: true,
      requireLowCarb: true,
      requireLowSugar: true,
    });
  });

  it("carnivore stacks with kosher/halal religion prefs", () => {
    expect(
      resolveDietarySuggestOptions({
        isJewish: true,
        preferCarnivore: true,
        preferLowSodium: true,
      })
    ).toMatchObject({
      softPreferKosher: true,
      requireCarnivore: true,
      requireLowSodium: true,
      requireVegan: false,
    });
  });

  it("carnivore clears plant require flags in resolve", () => {
    expect(
      resolveDietarySuggestOptions({
        preferCarnivore: true,
        preferVegan: true,
      })
    ).toMatchObject({
      requireCarnivore: true,
      requireVegan: false,
      requireVegetarian: false,
      requirePescatarian: false,
    });
  });
});

describe("macro hard-filter AND behavior", () => {
  const stock = pantry(["rice", "pasta", "chicken"]);
  const carnivore = recipe({
    id: "c",
    title: "Steak",
    carnivoreEligible: true,
    atkinsEligible: true,
    lowCarbEligible: true,
    lowSugarEligible: true,
    lowSodiumEligible: true,
    ingredients: [
      { id: "1", name: "chicken", quantity: 1, unit: "lb", optional: false },
    ],
  });
  const lowCarbOnly = recipe({
    id: "lc",
    title: "Low Carb Bowl",
    carnivoreEligible: false,
    atkinsEligible: true,
    lowCarbEligible: true,
    lowSugarEligible: true,
    lowSodiumEligible: false,
    ingredients: [
      { id: "1", name: "chicken", quantity: 1, unit: "lb", optional: false },
    ],
  });
  const sugary = recipe({
    id: "s",
    title: "Sweet Rice",
    carnivoreEligible: false,
    atkinsEligible: false,
    lowCarbEligible: false,
    lowSugarEligible: false,
    lowSodiumEligible: true,
    ingredients: [
      { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
    ],
  });

  it("hard-filters carnivoreEligible when requireCarnivore", () => {
    const results = suggestMeals([carnivore, lowCarbOnly, sugary], stock, {
      requireCarnivore: true,
    });
    expect(results.map((r) => r.recipe.id)).toEqual(["c"]);
  });

  it("ANDs Atkins + low sugar + low sodium", () => {
    const results = suggestMeals([carnivore, lowCarbOnly, sugary], stock, {
      requireAtkins: true,
      requireLowSugar: true,
      requireLowSodium: true,
    });
    expect(results.map((r) => r.recipe.id)).toEqual(["c"]);
  });

  it("carnivore hard-filter with kosher soft-boost still shows non-kosher", () => {
    const kosherCarnivore = recipe({
      id: "kc",
      title: "Kosher Steak",
      kosherEligible: true,
      carnivoreEligible: true,
      ingredients: [
        { id: "1", name: "chicken", quantity: 1, unit: "lb", optional: false },
      ],
    });
    const treyfCarnivore = recipe({
      id: "tc",
      title: "Bacon Steak",
      kosherEligible: false,
      carnivoreEligible: true,
      ingredients: [
        { id: "1", name: "chicken", quantity: 1, unit: "lb", optional: false },
      ],
    });
    const results = suggestMeals([kosherCarnivore, treyfCarnivore], stock, {
      softPreferKosher: true,
      requireCarnivore: true,
    });
    expect(results.map((r) => r.recipe.id).sort()).toEqual(["kc", "tc"]);
    expect(results[0]!.recipe.id).toBe("kc");
  });

  it("returns empty when prefer macro and none eligible", () => {
    expect(
      suggestMeals([sugary], stock, { requireCarnivore: true })
    ).toEqual([]);
  });

  it("passesMacroDietaryFilter checks each flag", () => {
    expect(
      passesMacroDietaryFilter(carnivore, { requireLowSodium: true })
    ).toBe(true);
    expect(
      passesMacroDietaryFilter(lowCarbOnly, { requireLowSodium: true })
    ).toBe(false);
    expect(
      passesMacroDietaryFilter(lowCarbOnly, {
        requireAtkins: true,
        requireLowCarb: true,
      })
    ).toBe(true);
  });
});

describe("DietaryBadges markup", () => {
  it("renders Kosher* / Halal* / plant labels in component source", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/DietaryBadges.tsx", "utf8");
    expect(src).toMatch(/Kosher\*/);
    expect(src).toMatch(/Halal\*/);
    expect(src).toMatch(/Vegan/);
    expect(src).toMatch(/Vegetarian/);
    expect(src).toMatch(/Pescatarian/);
    expect(src).toMatch(/Carnivore/);
    expect(src).toMatch(/Atkins/);
    expect(src).toMatch(/Low carb/);
    expect(src).toMatch(/Low sugar/);
    expect(src).toMatch(/Low sodium/);
    expect(src).toMatch(/certif/);
  });
});

describe("private diet chrome", () => {
  it("hides conflict pills from guests and users without prefs", () => {
    expect(
      dietConflictPills({ kosherEligible: false, halalEligible: false }, null)
    ).toEqual([]);
    expect(
      dietConflictPills({ kosherEligible: false }, { preferVegan: true })
    ).toEqual([]);
  });

  it("shows not-kosher / not-halal only for matching prefs", () => {
    expect(
      dietConflictPills(
        { kosherEligible: false, halalEligible: true },
        { preferKosher: true }
      )
    ).toEqual([{ kind: "kosher", label: "Not kosher" }]);
    expect(
      dietConflictPills(
        { kosherEligible: false, halalEligible: false, title: "Bacon" },
        { preferHalal: true }
      )
    ).toEqual([{ kind: "halal", label: "Not halal" }]);
  });

  it("picks similar eligible recipes by cuisine/course/dishKey", () => {
    const current = {
      id: "c1",
      title: "Shrimp Pasta",
      cuisine: "Italian",
      course: "main",
      dishKey: "pasta",
      kosherEligible: false,
    };
    const pool = [
      {
        id: "a",
        title: "Kosher Pasta",
        cuisine: "Italian",
        course: "main",
        dishKey: "pasta",
        kosherEligible: true,
      },
      {
        id: "b",
        title: "Kosher Rice",
        cuisine: "Asian",
        course: "side",
        dishKey: "rice",
        kosherEligible: true,
      },
      {
        id: "c",
        title: "Bacon Pasta",
        cuisine: "Italian",
        course: "main",
        dishKey: "pasta",
        kosherEligible: false,
      },
    ];
    const picks = pickSimilarEligibleRecipes(current, pool, { preferKosher: true }, 3);
    expect(picks[0]!.id).toBe("a");
    expect(picks.map((p) => p.id)).not.toContain("c");
  });
});

describe("allergens", () => {
  it("infers common allergen tags from ingredients", () => {
    const tags = inferAllergenTags({
      title: "Peanut Noodles",
      ingredients: [{ name: "peanut butter" }, { name: "soy sauce" }, { name: "wheat noodles" }],
    });
    expect(tags).toEqual(expect.arrayContaining(["peanuts", "soy", "wheat"]));
  });

  it("conflict warnings are personal to flagged allergens", () => {
    const recipe = {
      title: "Pad Thai",
      allergenTags: ["peanuts", "shellfish"],
      ingredients: [{ name: "shrimp" }, { name: "peanuts" }],
    };
    expect(conflictingAllergens(recipe, ["peanuts"])).toEqual(["peanuts"]);
    expect(conflictingAllergens(recipe, [])).toEqual([]);
    expect(hasAllergenConflict(recipe, null)).toBe(false);
  });

  it("soft-demotes allergen conflicts without removing them", () => {
    const withNuts = recipe({
      id: "n",
      title: "Peanut Stir Fry",
      allergenTags: ["peanuts"],
      ingredients: [
        { id: "1", name: "peanuts", quantity: 1, unit: "cups", optional: false },
        { id: "2", name: "rice", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const plain = recipe({
      id: "p",
      title: "Rice Bowl",
      ingredients: [
        { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
      ],
    });
    const stock = [
      { id: "1", name: "rice", quantity: 1, unit: "each", category: null, tags: [] },
      { id: "2", name: "peanuts", quantity: 1, unit: "each", category: null, tags: [] },
    ];
    const results = suggestMeals([withNuts, plain], stock, {
      allergenFlags: ["peanuts"],
    });
    expect(results.map((r) => r.recipe.id)).toContain("n");
    expect(results.map((r) => r.recipe.id)).toContain("p");
    expect(results[0]!.recipe.id).toBe("p");
  });
});
