import { describe, expect, it } from "vitest";
import {
  matchesMood,
  moodBoost,
  parseMoodParam,
  pickSurprise,
} from "@/lib/moods";
import { suggestMeals } from "@/lib/suggestions";
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

const eggIng = [
  { id: "1", name: "eggs", quantity: 2, unit: "each", optional: false },
];

describe("parseMoodParam", () => {
  it("accepts known moods and rejects junk", () => {
    expect(parseMoodParam("comfort")).toBe("comfort");
    expect(parseMoodParam("quick")).toBe("quick");
    expect(parseMoodParam("nope")).toBeUndefined();
    expect(parseMoodParam(null)).toBeUndefined();
  });
});

describe("matchesMood", () => {
  it("any / undefined always matches", () => {
    const r = recipe({ title: "Anything", ingredients: eggIng });
    expect(matchesMood(r, "any")).toBe(true);
    expect(matchesMood(r, undefined)).toBe(true);
  });

  it("matches comfort via tags and keywords", () => {
    const soup = recipe({
      title: "Tomato Soup",
      tags: ["comfort"],
      ingredients: eggIng,
    });
    const stew = recipe({
      title: "Long Stew Night",
      description: "Cozy pot of stew",
      ingredients: eggIng,
    });
    const salad = recipe({
      title: "Green Salad",
      tags: ["fresh"],
      ingredients: eggIng,
    });
    expect(matchesMood(soup, "comfort")).toBe(true);
    expect(matchesMood(stew, "comfort")).toBe(true);
    expect(matchesMood(salad, "comfort")).toBe(false);
  });

  it("matches fresh / light and spicy", () => {
    const lemon = recipe({
      title: "Lemon-Garlic Pasta",
      tags: ["bright"],
      ingredients: eggIng,
    });
    const chili = recipe({
      title: "Chili Bowl",
      tags: ["chili"],
      ingredients: eggIng,
    });
    expect(matchesMood(lemon, "fresh")).toBe(true);
    expect(matchesMood(chili, "spicy")).toBe(true);
    expect(matchesMood(lemon, "spicy")).toBe(false);
  });

  it("matches quick by time or tags (respects time signal)", () => {
    const fast = recipe({
      title: "Flash Eggs",
      cookTimeMinutes: 12,
      ingredients: eggIng,
    });
    const tagged = recipe({
      title: "Weeknight Pasta",
      tags: ["weeknight"],
      cookTimeMinutes: 35,
      ingredients: eggIng,
    });
    const slow = recipe({
      title: "Roast",
      cookTimeMinutes: 90,
      ingredients: eggIng,
    });
    expect(matchesMood(fast, "quick")).toBe(true);
    expect(matchesMood(tagged, "quick")).toBe(true);
    expect(matchesMood(slow, "quick")).toBe(false);
  });

  it("matches sweet, breakfast, one-pot, struggle", () => {
    const cookies = recipe({
      title: "Chocolate Chip Cookies",
      tags: ["dessert", "baking"],
      ingredients: eggIng,
    });
    const pancakes = recipe({
      title: "Pancakes",
      tags: ["breakfast"],
      ingredients: eggIng,
    });
    const bowl = recipe({
      title: "Rice Bowl",
      tags: ["one-bowl"],
      ingredients: eggIng,
    });
    const struggle = recipe({
      title: "Fried Rice",
      isStruggleMeal: true,
      costTier: "cheap",
      ingredients: eggIng,
    });
    expect(matchesMood(cookies, "sweet")).toBe(true);
    expect(matchesMood(pancakes, "breakfast")).toBe(true);
    expect(matchesMood(bowl, "one-pot")).toBe(true);
    expect(matchesMood(struggle, "struggle")).toBe(true);
    expect(matchesMood(cookies, "breakfast")).toBe(false);
  });

  it("moodBoost is zero for non-matches and positive for matches", () => {
    const cookies = recipe({
      title: "Cookies",
      tags: ["dessert"],
      ingredients: eggIng,
    });
    expect(moodBoost(cookies, "sweet")).toBeGreaterThan(0);
    expect(moodBoost(cookies, "spicy")).toBe(0);
    expect(moodBoost(cookies, "any")).toBe(0);
  });
});

describe("suggestMeals mood filter", () => {
  const stock = pantry(["eggs", "flour", "butter", "rice"]);
  const recipes = [
    recipe({
      id: "dessert",
      title: "Cookies",
      tags: ["dessert", "baking"],
      ingredients: [
        { id: "1", name: "flour", quantity: 1, unit: "cups", optional: false },
        { id: "2", name: "butter", quantity: 1, unit: "stick", optional: false },
        { id: "3", name: "eggs", quantity: 1, unit: "each", optional: false },
      ],
    }),
    recipe({
      id: "breakfast",
      title: "Scrambled Eggs",
      tags: ["breakfast", "quick"],
      cookTimeMinutes: 8,
      ingredients: eggIng,
    }),
    recipe({
      id: "rice",
      title: "Plain Rice",
      tags: ["side"],
      cookTimeMinutes: 25,
      ingredients: [
        { id: "1", name: "rice", quantity: 1, unit: "cups", optional: false },
      ],
    }),
  ];

  it("filters suggestions by mood while keeping pantry matching", () => {
    const sweet = suggestMeals(recipes, stock, { mood: "sweet" });
    expect(sweet.map((s) => s.recipe.id)).toEqual(["dessert"]);

    const breakfast = suggestMeals(recipes, stock, { mood: "breakfast" });
    expect(breakfast.some((s) => s.recipe.id === "breakfast")).toBe(true);
    expect(breakfast.some((s) => s.recipe.id === "dessert")).toBe(false);
  });

  it("quick mood still respects maxMinutes", () => {
    const results = suggestMeals(recipes, stock, {
      mood: "quick",
      maxMinutes: 15,
    });
    expect(results.some((s) => s.recipe.id === "breakfast")).toBe(true);
    // Plain rice is 25 min — out of time budget even if somehow tagged
    expect(results.some((s) => s.recipe.id === "rice")).toBe(false);
  });
});

describe("pickSurprise", () => {
  it("returns null when suggestions are empty", () => {
    expect(pickSurprise([])).toBeNull();
  });

  it("picks from non-empty suggestions and prefers canMakeNow", () => {
    const pool = [
      {
        recipe: { id: "near" },
        canMakeNow: false,
        nearMiss: true,
      },
      {
        recipe: { id: "now" },
        canMakeNow: true,
        nearMiss: false,
      },
    ];
    for (let i = 0; i < 20; i++) {
      const pick = pickSurprise(pool);
      expect(pick).not.toBeNull();
      expect(pick!.recipe.id).toBe("now");
    }
  });

  it("avoids the same recipe twice in a row when possible", () => {
    const pool = [
      { recipe: { id: "a" }, canMakeNow: true, nearMiss: false },
      { recipe: { id: "b" }, canMakeNow: true, nearMiss: false },
    ];
    const first = pickSurprise(pool);
    expect(first).not.toBeNull();
    const second = pickSurprise(pool, first!.recipe.id);
    expect(second).not.toBeNull();
    expect(second!.recipe.id).not.toBe(first!.recipe.id);
  });

  it("falls back to the only option when exclude would empty the pool", () => {
    const pool = [
      { recipe: { id: "only" }, canMakeNow: true, nearMiss: false },
    ];
    const pick = pickSurprise(pool, "only");
    expect(pick?.recipe.id).toBe("only");
  });
});
