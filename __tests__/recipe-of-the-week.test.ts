import { describe, expect, it } from "vitest";
import {
  classifyMealSlot,
  pickFeaturedMeals,
  type MealClassifiable,
} from "@/lib/featured-meals";

const r = (
  id: string,
  title: string,
  tags: string[] = []
): MealClassifiable => ({ id, title, tags });

describe("classifyMealSlot", () => {
  it("uses tags first", () => {
    expect(classifyMealSlot(r("1", "Anything", ["breakfast"]))).toBe(
      "breakfast"
    );
    expect(classifyMealSlot(r("2", "Anything", ["lunch"]))).toBe("lunch");
    expect(classifyMealSlot(r("3", "Anything", ["dinner"]))).toBe("dinner");
  });

  it("falls back to title heuristics", () => {
    expect(classifyMealSlot(r("1", "Scrambled Eggs"))).toBe("breakfast");
    expect(classifyMealSlot(r("2", "Grilled Cheese Sandwich"))).toBe("lunch");
    expect(classifyMealSlot(r("3", "Basic Roast Chicken"))).toBe("dinner");
  });
});

describe("pickFeaturedMeals", () => {
  const catalog = [
    r("b1", "Pancakes", ["breakfast"]),
    r("b2", "Scrambled Eggs", ["breakfast"]),
    r("l1", "Grilled Cheese", ["lunch", "sandwich"]),
    r("l2", "Tomato Soup", ["soup", "lunch"]),
    r("d1", "Roast Chicken", ["dinner", "roast"]),
    r("d2", "Garlic Fried Rice", ["dinner", "rice"]),
    r("x1", "Mystery Dish", []),
  ];

  it("returns three slots: breakfast, lunch, dinner", () => {
    const picks = pickFeaturedMeals(catalog, () => 0);
    expect(picks).toHaveLength(3);
    expect(picks.map((p) => p.slot)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
    ]);
    expect(picks.map((p) => p.label)).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
    ]);
  });

  it("uses distinct recipes when the pool allows", () => {
    const picks = pickFeaturedMeals(catalog, () => 0);
    const ids = picks.map((p) => p.recipe.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("can vary across calls with different rng", () => {
    const a = pickFeaturedMeals(catalog, () => 0);
    const b = pickFeaturedMeals(catalog, () => 0.99);
    // With enough pool diversity, different seeds → different breakfast pick
    expect(a[0]!.recipe.id).not.toEqual(b[0]!.recipe.id);
  });

  it("is not week-stable: Math.random-driven calls may differ", () => {
    // Smoke: function accepts default rng and still returns 3
    const picks = pickFeaturedMeals(catalog);
    expect(picks).toHaveLength(3);
  });

  it("falls back when a slot pool is empty", () => {
    const thin = [
      r("b1", "Pancakes", ["breakfast"]),
      r("d1", "Roast Chicken", ["dinner"]),
      r("x1", "Mystery", []),
    ];
    const picks = pickFeaturedMeals(thin, () => 0);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.recipe.id)).size).toBeGreaterThanOrEqual(
      2
    );
  });
});
