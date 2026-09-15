import { describe, expect, it } from "vitest";
import {
  effectiveObservant,
  inferDietaryEligibility,
  resolveDietarySuggestOptions,
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
    ).toEqual({
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
    ).toEqual({
      softPreferKosher: false,
      requireKosher: true,
      requireHalal: false,
    });
  });

  it("hard-filters halal when preferHalal", () => {
    expect(resolveDietarySuggestOptions({ preferHalal: true })).toEqual({
      softPreferKosher: false,
      requireKosher: false,
      requireHalal: true,
    });
  });

  it("requires both when observant + preferHalal", () => {
    expect(
      resolveDietarySuggestOptions({
        isJewish: true,
        isObservant: true,
        preferHalal: true,
      })
    ).toEqual({
      softPreferKosher: false,
      requireKosher: true,
      requireHalal: true,
    });
  });

  it("shows sections from flags", () => {
    expect(showKosherSection({ isJewish: true })).toBe(true);
    expect(showKosherSection({ preferKosher: true })).toBe(true);
    expect(showKosherSection({})).toBe(false);
    expect(showHalalSection({ preferHalal: true })).toBe(true);
    expect(showHalalSection({})).toBe(false);
  });
});

describe("inferDietaryEligibility heuristics", () => {
  it("marks vegetarian staples eligible for both", () => {
    const r = inferDietaryEligibility({
      title: "Rice and Beans",
      ingredients: [{ name: "rice" }, { name: "black beans" }],
    });
    expect(r).toEqual({ kosherEligible: true, halalEligible: true });
  });

  it("excludes pork from kosher and halal", () => {
    const r = inferDietaryEligibility({
      title: "BLT",
      ingredients: [{ name: "bacon" }, { name: "bread" }],
    });
    expect(r.kosherEligible).toBe(false);
    expect(r.halalEligible).toBe(false);
  });

  it("excludes shellfish from kosher but not necessarily alcohol rules", () => {
    const r = inferDietaryEligibility({
      title: "Shrimp Pasta",
      ingredients: [{ name: "shrimp" }, { name: "pasta" }],
    });
    expect(r.kosherEligible).toBe(false);
    expect(r.halalEligible).toBe(true);
  });

  it("excludes alcohol-heavy from halal", () => {
    const r = inferDietaryEligibility({
      title: "Wine Sauce Chicken",
      ingredients: [{ name: "chicken" }, { name: "red wine" }],
    });
    expect(r.halalEligible).toBe(false);
    expect(r.kosherEligible).toBe(true);
  });
});

describe("suggestMeals dietary filters/boost", () => {
  const kosher = recipe({
    id: "k",
    title: "Kosher Rice",
    kosherEligible: true,
    halalEligible: true,
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

  it("hard-filters to kosherEligible when requireKosher", () => {
    const results = suggestMeals([kosher, treyf, halalOnly], stock, {
      requireKosher: true,
    });
    expect(results.map((r) => r.recipe.id)).toEqual(["k"]);
  });

  it("hard-filters to halalEligible when requireHalal", () => {
    const results = suggestMeals([kosher, treyf, halalOnly], stock, {
      requireHalal: true,
    });
    expect(results.every((r) => r.recipe.halalEligible)).toBe(true);
    expect(results.map((r) => r.recipe.id).sort()).toEqual(["h", "k"]);
  });

  it("ANDs observant kosher + preferHalal", () => {
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
});

describe("DietaryBadges markup", () => {
  it("renders Kosher* / Halal* labels in component source", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/DietaryBadges.tsx", "utf8");
    expect(src).toMatch(/Kosher\*/);
    expect(src).toMatch(/Halal\*/);
    expect(src).toMatch(/certified/);
  });
});
