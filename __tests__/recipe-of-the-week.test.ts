import { describe, expect, it } from "vitest";
import {
  classifyMealSlot,
  isoWeekKey,
  pickRecipeOfTheWeek,
  type MealClassifiable,
} from "@/lib/recipe-of-the-week";

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

describe("pickRecipeOfTheWeek", () => {
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
    const picks = pickRecipeOfTheWeek(catalog, "2026-W37");
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

  it("is stable for the same ISO week", () => {
    const a = pickRecipeOfTheWeek(catalog, "2026-W37");
    const b = pickRecipeOfTheWeek(catalog, "2026-W37");
    expect(a.map((p) => p.recipe.id)).toEqual(b.map((p) => p.recipe.id));
  });

  it("can differ across weeks", () => {
    const a = pickRecipeOfTheWeek(catalog, "2026-W37");
    const b = pickRecipeOfTheWeek(catalog, "2026-W38");
    // Not guaranteed different for tiny pools, but ids are always defined
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    expect(a.every((p) => p.recipe.id)).toBe(true);
  });

  it("falls back when a slot pool is empty", () => {
    const thin = [
      r("b1", "Pancakes", ["breakfast"]),
      r("d1", "Roast Chicken", ["dinner"]),
      r("x1", "Mystery", []),
    ];
    const picks = pickRecipeOfTheWeek(thin, "2026-W37");
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.recipe.id)).size).toBeGreaterThanOrEqual(
      2
    );
  });

  it("isoWeekKey looks like YYYY-Www", () => {
    expect(isoWeekKey(new Date("2026-09-08T12:00:00Z"))).toMatch(
      /^\d{4}-W\d{2}$/
    );
  });
});
