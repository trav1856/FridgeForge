import { describe, expect, it } from "vitest";
import {
  estimateRecipeNutrition,
  findNutritionEntry,
  quantityToGrams,
  NUTRITION_TABLE,
  percentDailyValue,
  FDA_DAILY_VALUES,
} from "@/lib/recipe-nutrition";

const friedRiceIngredients = [
  { name: "White rice", quantity: 2, unit: "cups" },
  { name: "Eggs", quantity: 2, unit: "each" },
  { name: "Garlic", quantity: 3, unit: "cloves" },
  { name: "Soy sauce", quantity: 2, unit: "tbsp" },
  { name: "Vegetable oil", quantity: 2, unit: "tbsp" },
  { name: "Chili flakes", quantity: 0.5, unit: "tsp", optional: true },
];

describe("recipe-nutrition", () => {
  it("matches common staples loosely", () => {
    expect(findNutritionEntry("White rice")?.key).toBe("rice");
    expect(findNutritionEntry("large eggs")?.key).toBe("egg");
    expect(findNutritionEntry("Vegetable oil")?.key).toBe("oil");
    expect(findNutritionEntry("soy sauce")?.key).toBe("soy sauce");
    expect(findNutritionEntry("peanut butter")?.key).toBe("peanut butter");
  });

  it("converts cups/tbsp/each to grams", () => {
    const rice = NUTRITION_TABLE.rice!;
    expect(quantityToGrams(2, "cups", rice)).toBeCloseTo(370, 0);
    expect(quantityToGrams(2, "tbsp", NUTRITION_TABLE.oil!)).toBeCloseTo(28, 0);
    expect(quantityToGrams(2, "each", NUTRITION_TABLE.egg!)).toBe(100);
    expect(quantityToGrams(3, "cloves", NUTRITION_TABLE.garlic!)).toBe(9);
  });

  it("estimates non-zero kcal for fried rice ingredients", () => {
    const est = estimateRecipeNutrition(friedRiceIngredients, 2);
    expect(est.matchedCount).toBeGreaterThanOrEqual(5);
    expect(est.total.kcal).toBeGreaterThan(400);
    expect(est.perServing.kcal).toBeGreaterThan(200);
    expect(est.perServing.protein).toBeGreaterThan(0);
    expect(est.perServing.fat).toBeGreaterThan(0);
    expect(est.perServing.carbs).toBeGreaterThan(0);
    expect(est.coverageLabel).toMatch(/Based on/);
    expect(Math.abs(est.perServing.kcal * 2 - est.total.kcal)).toBeLessThanOrEqual(2);
  });

  it("does not crash on unknown ingredients", () => {
    const est = estimateRecipeNutrition(
      [
        { name: "Mystery spice blend XYZ", quantity: 1, unit: "tbsp" },
        { name: "dragon fruit nectar", quantity: 0.5, unit: "cups" },
      ],
      4
    );
    expect(est.matchedCount).toBe(0);
    expect(est.total.kcal).toBe(0);
    expect(est.perServing.kcal).toBe(0);
    expect(est.coverageLabel).toMatch(/No matching/i);
  });

  it("reports partial coverage when some ingredients match", () => {
    const est = estimateRecipeNutrition(
      [
        { name: "Eggs", quantity: 2, unit: "each" },
        { name: "Unicorn dust", quantity: 1, unit: "tsp" },
      ],
      1
    );
    expect(est.matchedCount).toBe(1);
    expect(est.totalCount).toBe(2);
    expect(est.coverageLabel).toBe("Based on 1 of 2 ingredients");
    expect(est.total.kcal).toBeGreaterThan(0);
  });

  it("prefers pantry nutritionJson macros when provided", () => {
    const est = estimateRecipeNutrition(
      [{ name: "Eggs", quantity: 1, unit: "each" }],
      1,
      {
        pantryNutritionByName: {
          Eggs: JSON.stringify({
            caloriesPer100g: 200,
            proteinPer100g: 20,
            fatPer100g: 12,
            carbsPer100g: 1,
            source: "openfoodfacts",
          }),
        },
      }
    );
    expect(est.matchedCount).toBe(1);
    expect(est.total.kcal).toBe(100);
    expect(est.lines[0]?.source).toBe("pantry");
  });

  it("handles empty ingredient list", () => {
    const est = estimateRecipeNutrition([], 2);
    expect(est.matchedCount).toBe(0);
    expect(est.totalCount).toBe(0);
    expect(est.total.kcal).toBe(0);
  });

  it("aggregates micronutrients and supports FDA %DV helpers", () => {
    expect(FDA_DAILY_VALUES.fat).toBe(78);
    expect(percentDailyValue(39, "fat")).toBe(50);
    expect(percentDailyValue(undefined, "sodium")).toBeNull();

    const est = estimateRecipeNutrition(
      [
        { name: "Eggs", quantity: 2, unit: "each" },
        { name: "Butter", quantity: 1, unit: "tbsp" },
      ],
      1
    );
    expect(est.total.cholesterol).toBeGreaterThan(0);
    expect(est.total.saturatedFat).toBeGreaterThan(0);
    expect(est.total.calcium).toBeGreaterThan(0);
    // Missing from these staples should still leave addedSugars undefined
    expect(est.total.addedSugars).toBeUndefined();
  });

  it("includes egg cholesterol in fried-rice style estimate", () => {
    const est = estimateRecipeNutrition(friedRiceIngredients, 2);
    expect(est.perServing.cholesterol).toBeGreaterThan(0);
    expect(est.perServing.sodium).toBeGreaterThan(0);
    expect(est.total.iron).toBeGreaterThan(0);
  });
});
