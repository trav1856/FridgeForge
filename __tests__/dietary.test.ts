import { describe, expect, it } from "vitest";
import {
  adaptHintForPrefs,
  applyJewishHalalSupersede,
  applyPlantPrefToggle,
  effectiveObservant,
  inferAdaptNotes,
  inferDietaryEligibility,
  normalizePlantPrefs,
  passesPlantDietaryFilter,
  recipeContainsAlcohol,
  resolveDietarySuggestOptions,
  satisfiesHalal,
  showHalalSection,
  showKosherSection,
} from "@/lib/dietary";
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
  veganAdaptNote: partial.veganAdaptNote ?? null,
  vegetarianAdaptNote: partial.vegetarianAdaptNote ?? null,
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

  it("hard-filters kosher when observant Jewish", () => {
    expect(
      resolveDietarySuggestOptions({ isJewish: true, isObservant: true })
    ).toMatchObject({
      softPreferKosher: false,
      requireKosher: true,
      requireHalal: false,
    });
  });

  it("hard-filters halal when preferHalal", () => {
    expect(resolveDietarySuggestOptions({ preferHalal: true })).toMatchObject({
      softPreferKosher: false,
      requireKosher: false,
      softPreferHalal: false,
      requireHalal: true,
    });
  });

  it("Jewish supersedes preferHalal / isMuslim in resolve", () => {
    expect(
      resolveDietarySuggestOptions({
        isJewish: true,
        isObservant: true,
        preferHalal: true,
        isMuslim: true,
      })
    ).toMatchObject({
      softPreferKosher: false,
      requireKosher: true,
      softPreferHalal: false,
      requireHalal: false,
    });
  });

  it("soft-prefers halal when Muslim (not preferHalal, not Jewish)", () => {
    expect(resolveDietarySuggestOptions({ isMuslim: true })).toMatchObject({
      softPreferHalal: true,
      requireHalal: false,
    });
    expect(
      resolveDietarySuggestOptions({ isMuslim: true, preferHalal: true })
    ).toMatchObject({
      softPreferHalal: false,
      requireHalal: true,
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

  it("applyJewishHalalSupersede clears Muslim/Halal when Jewish", () => {
    expect(
      applyJewishHalalSupersede({
        isJewish: true,
        isMuslim: true,
        preferHalal: true,
      })
    ).toMatchObject({ isMuslim: false, preferHalal: false, isJewish: true });
    expect(
      applyJewishHalalSupersede({ isMuslim: true, preferHalal: true })
    ).toMatchObject({ isMuslim: true, preferHalal: true });
  });

  it("shows sections from flags", () => {
    expect(showKosherSection({ isJewish: true })).toBe(true);
    expect(showKosherSection({ preferKosher: true })).toBe(true);
    expect(showKosherSection({})).toBe(false);
    expect(showHalalSection({ preferHalal: true })).toBe(true);
    expect(showHalalSection({ isMuslim: true })).toBe(true);
    expect(showHalalSection({})).toBe(false);
    expect(
      showHalalSection({ isJewish: true, isMuslim: true, preferHalal: true })
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
    });
    expect(
      applyPlantPrefToggle({ preferVegan: true }, "preferPescatarian", true)
    ).toEqual({
      preferVegan: false,
      preferVegetarian: false,
      preferPescatarian: true,
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
    expect(r).toEqual({
      kosherEligible: true,
      halalEligible: true,
      vegetarianEligible: true,
      pescatarianEligible: true,
      veganEligible: true,
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

  it("hard-filters to kosherEligible when requireKosher", () => {
    const results = suggestMeals([kosher, treyf, halalOnly], stock, {
      requireKosher: true,
    });
    expect(results.map((r) => r.recipe.id)).toEqual(["k"]);
  });

  it("hard-filters to satisfiesHalal when requireHalal", () => {
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
      { requireHalal: true }
    );
    const ids = results.map((r) => r.recipe.id).sort();
    expect(ids).toEqual(["h", "k", "kna"]);
    expect(results.every((r) => satisfiesHalal(r.recipe))).toBe(true);
  });

  it("ANDs observant kosher + requireHalal at engine level", () => {
    const results = suggestMeals([kosher, treyf, halalOnly], stock, {
      requireKosher: true,
      requireHalal: true,
    });
    expect(results.map((r) => r.recipe.id)).toEqual(["k"]);
  });

  it("ANDs struggle hard-filter with kosher", () => {
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
      { struggleMode: true, requireKosher: true }
    );
    expect(results.map((r) => r.recipe.id)).toEqual(["sk"]);
  });

  it("returns empty when requireKosher and none eligible", () => {
    const results = suggestMeals([treyf], stock, { requireKosher: true });
    expect(results).toEqual([]);
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
    expect(src).toMatch(/certified/);
  });
});
