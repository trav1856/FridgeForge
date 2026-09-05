import { describe, expect, it } from "vitest";
import { scoreRecipe, suggestMeals } from "@/lib/suggestions";
import { namesMatch, normalizeName } from "@/lib/normalize";
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
  techniqueTips: partial.techniqueTips ?? [],
  flavorBoosters: partial.flavorBoosters ?? [],
  ingredients: partial.ingredients,
});

describe("normalize / namesMatch", () => {
  it("normalizes casing and descriptors", () => {
    expect(normalizeName("Fresh Large Eggs")).toContain("eggs");
  });

  it("matches aliases like rice variants", () => {
    expect(namesMatch("white rice", "rice")).toBe(true);
    expect(namesMatch("soy sauce", "soy")).toBe(true);
    expect(namesMatch("spaghetti", "pasta")).toBe(true);
  });

  it("does not treat peanut butter as butter", () => {
    expect(namesMatch("peanut butter", "butter")).toBe(false);
    expect(namesMatch("butter", "peanut butter")).toBe(false);
  });
});

describe("scoreRecipe", () => {
  const friedRice = recipe({
    title: "Fried Rice",
    isStruggleMeal: true,
    costTier: "cheap",
    tags: ["struggle"],
    ingredients: [
      { id: "1", name: "rice", quantity: 2, unit: "cups", optional: false },
      { id: "2", name: "eggs", quantity: 2, unit: "each", optional: false },
      { id: "3", name: "soy sauce", quantity: 1, unit: "tbsp", optional: false },
      { id: "4", name: "chili flakes", quantity: 1, unit: "tsp", optional: true },
    ],
  });

  it("scores can-make-now highest when pantry is complete", () => {
    const result = scoreRecipe(
      friedRice,
      pantry(["White rice", "Eggs", "Soy sauce"])
    );
    expect(result.canMakeNow).toBe(true);
    expect(result.missingCount).toBe(0);
    expect(result.score).toBeGreaterThan(100);
    expect(result.creativeNote).toBeTruthy();
  });

  it("treats 1-2 cheap missing staples as near-miss", () => {
    const result = scoreRecipe(friedRice, pantry(["White rice", "Eggs"]), {
      maxMissing: 2,
    });
    expect(result.canMakeNow).toBe(false);
    expect(result.nearMiss).toBe(true);
    expect(result.missingIngredients).toContain("soy sauce");
  });

  it("boosts struggle meals in struggle mode", () => {
    const fancy = recipe({
      title: "Fancy",
      costTier: "moderate",
      isStruggleMeal: false,
      ingredients: [
        { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
        { id: "2", name: "eggs", quantity: 1, unit: "each", optional: false },
      ],
    });
    const p = pantry(["rice", "eggs"]);
    const normal = scoreRecipe(friedRice, p, { struggleMode: false });
    const struggle = scoreRecipe(friedRice, p, { struggleMode: true });
    const fancyStruggle = scoreRecipe(fancy, p, { struggleMode: true });
    expect(struggle.struggleBoost).toBeGreaterThan(normal.struggleBoost);
    expect(struggle.score).toBeGreaterThan(fancyStruggle.score);
  });
});

describe("suggestMeals", () => {
  it("returns sorted suggestions and filters weak matches", () => {
    const recipes = [
      recipe({
        id: "a",
        title: "Rice Bowl",
        isStruggleMeal: true,
        costTier: "cheap",
        ingredients: [
          { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
          { id: "2", name: "beans", quantity: 1, unit: "cups", optional: false },
        ],
      }),
      recipe({
        id: "b",
        title: "Needs Everything",
        costTier: "moderate",
        ingredients: [
          { id: "1", name: "salmon", quantity: 1, unit: "lb", optional: false },
          { id: "2", name: "asparagus", quantity: 1, unit: "bunch", optional: false },
          { id: "3", name: "cream", quantity: 1, unit: "cup", optional: false },
          { id: "4", name: "wine", quantity: 1, unit: "cup", optional: false },
        ],
      }),
    ];
    const results = suggestMeals(recipes, pantry(["rice", "black beans"]), {
      struggleMode: true,
    });
    expect(results[0]?.recipe.title).toBe("Rice Bowl");
    expect(results.some((r) => r.recipe.title === "Needs Everything")).toBe(
      false
    );
  });
});

describe("suggestMeals time filter", () => {
  const quick = recipe({
    id: "quick",
    title: "Quick Eggs",
    cookTimeMinutes: 15,
    ingredients: [
      { id: "1", name: "eggs", quantity: 2, unit: "each", optional: false },
    ],
  });
  const medium = recipe({
    id: "medium",
    title: "Rice Bowl",
    cookTimeMinutes: 30,
    ingredients: [
      { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
      { id: "2", name: "eggs", quantity: 1, unit: "each", optional: false },
    ],
  });
  const stew = recipe({
    id: "stew",
    title: "Long Stew",
    cookTimeMinutes: 60,
    ingredients: [
      { id: "1", name: "beans", quantity: 1, unit: "cups", optional: false },
      { id: "2", name: "rice", quantity: 1, unit: "cups", optional: false },
    ],
  });
  const unknown = recipe({
    id: "unk",
    title: "Mystery Meal",
    cookTimeMinutes: null,
    ingredients: [
      { id: "1", name: "eggs", quantity: 1, unit: "each", optional: false },
    ],
  });
  const stock = pantry(["eggs", "rice", "beans"]);

  it("filters out recipes over maxMinutes", () => {
    const results = suggestMeals([quick, medium, stew], stock, {
      maxMinutes: 30,
    });
    const titles = results.map((r) => r.recipe.title);
    expect(titles).toContain("Quick Eggs");
    expect(titles).toContain("Rice Bowl");
    expect(titles).not.toContain("Long Stew");
  });

  it("excludes unknown cook times by default when maxMinutes is set", () => {
    const results = suggestMeals([quick, unknown], stock, { maxMinutes: 30 });
    expect(results.some((r) => r.recipe.title === "Mystery Meal")).toBe(false);
    expect(results.some((r) => r.recipe.title === "Quick Eggs")).toBe(true);
  });

  it("includes unknown cook times when includeUnknownTime is true", () => {
    const results = suggestMeals([quick, unknown], stock, {
      maxMinutes: 30,
      includeUnknownTime: true,
    });
    expect(results.some((r) => r.recipe.title === "Mystery Meal")).toBe(true);
  });

  it("soft-boosts shorter recipes when time is tight", () => {
    const withBudget = suggestMeals([quick, medium], stock, { maxMinutes: 30 });
    const without = suggestMeals([quick, medium], stock, {});
    const quickWith = withBudget.find((r) => r.recipe.id === "quick")!;
    const quickWithout = without.find((r) => r.recipe.id === "quick")!;
    expect(quickWith.score).toBeGreaterThan(quickWithout.score);
  });
});
