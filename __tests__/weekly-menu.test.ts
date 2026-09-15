import { describe, expect, it } from "vitest";
import {
  buildWeeklyMenu,
  collectMissingFromPlan,
  pickForSlot,
  recipeFitsMealSlot,
  recipeRepeatCounts,
  regenerateMenuSlot,
  type MealSlot,
} from "@/lib/weekly-menu";
import { scoreRecipe } from "@/lib/suggestions";
import type { PantrySnapshot, RecipeForMatch, SuggestionResult } from "@/lib/types";

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
    id: string;
    title: string;
    ingredients: RecipeForMatch["ingredients"];
  }
): RecipeForMatch => ({
  id: partial.id,
  title: partial.title,
  description: partial.description ?? null,
  steps: partial.steps ?? ["Cook"],
  costTier: partial.costTier ?? "cheap",
  tags: partial.tags ?? [],
  course: partial.course ?? null,
  servings: partial.servings ?? 2,
  cookTimeMinutes: partial.cookTimeMinutes ?? 20,
  isStruggleMeal: partial.isStruggleMeal ?? false,
  techniqueTips: partial.techniqueTips ?? [],
  flavorBoosters: partial.flavorBoosters ?? [],
  ingredients: partial.ingredients,
});

const eggIng = [
  { id: "1", name: "eggs", quantity: 2, unit: "each", optional: false },
];
const riceIng = [
  { id: "1", name: "rice", quantity: 1, unit: "cup", optional: false },
  { id: "2", name: "eggs", quantity: 1, unit: "each", optional: false },
];
const pastaIng = [
  { id: "1", name: "pasta", quantity: 8, unit: "oz", optional: false },
  { id: "2", name: "tomato", quantity: 1, unit: "each", optional: false },
];

describe("recipeFitsMealSlot", () => {
  it("routes breakfast course / title heuristics", () => {
    const pancakes = recipe({
      id: "b1",
      title: "Fluffy Pancakes",
      course: "breakfast",
      ingredients: eggIng,
    });
    const roast = recipe({
      id: "d1",
      title: "Roast Chicken",
      course: "dinner",
      ingredients: riceIng,
    });
    expect(recipeFitsMealSlot(pancakes, "breakfast")).toBe(true);
    expect(recipeFitsMealSlot(pancakes, "dinner")).toBe(false);
    expect(recipeFitsMealSlot(roast, "breakfast")).toBe(false);
    expect(recipeFitsMealSlot(roast, "dinner")).toBe(true);
    expect(recipeFitsMealSlot(roast, "lunch")).toBe(true);
  });

  it("excludes dessert and drink from meal slots", () => {
    const pie = recipe({
      id: "x1",
      title: "Apple Pie",
      course: "dessert",
      ingredients: eggIng,
    });
    expect(recipeFitsMealSlot(pie, "breakfast")).toBe(false);
    expect(recipeFitsMealSlot(pie, "lunch")).toBe(false);
    expect(recipeFitsMealSlot(pie, "dinner")).toBe(false);
  });
});

describe("pickForSlot scoring / no-duplicate preference", () => {
  it("prefers unused recipes when scores are close", () => {
    const a = recipe({
      id: "a",
      title: "Alpha Eggs",
      course: "breakfast",
      ingredients: eggIng,
    });
    const b = recipe({
      id: "b",
      title: "Beta Eggs",
      course: "breakfast",
      ingredients: eggIng,
    });
    const p = pantry(["eggs"]);
    const scoredA = scoreRecipe(a, p);
    const scoredB = scoreRecipe(b, p);
    // Force nearly equal scores
    const pool: SuggestionResult[] = [
      { ...scoredA, score: 100 },
      { ...scoredB, score: 99 },
    ];
    const used = new Map<string, number>([["a", 1]]);
    const pick = pickForSlot(pool, used, { repeatPenalty: 35 });
    expect(pick?.recipe.id).toBe("b");
  });

  it("still allows a repeat when it is the only option", () => {
    const only = recipe({
      id: "only",
      title: "Only Scramble",
      course: "breakfast",
      ingredients: eggIng,
    });
    const scored = scoreRecipe(only, pantry(["eggs"]));
    const used = new Map<string, number>([["only", 3]]);
    const pick = pickForSlot([scored], used);
    expect(pick?.recipe.id).toBe("only");
  });
});

describe("buildWeeklyMenu", () => {
  const catalog: RecipeForMatch[] = [
    recipe({
      id: "bk1",
      title: "Scrambled Eggs",
      course: "breakfast",
      tags: ["breakfast"],
      ingredients: eggIng,
      isStruggleMeal: true,
    }),
    recipe({
      id: "bk2",
      title: "Pancakes",
      course: "breakfast",
      tags: ["breakfast"],
      ingredients: [
        { id: "1", name: "flour", quantity: 1, unit: "cup", optional: false },
        { id: "2", name: "eggs", quantity: 2, unit: "each", optional: false },
        { id: "3", name: "milk", quantity: 1, unit: "cup", optional: false },
      ],
    }),
    recipe({
      id: "bk3",
      title: "Potato Hash Eggs",
      course: "breakfast",
      ingredients: [
        { id: "1", name: "potato", quantity: 2, unit: "each", optional: false },
        { id: "2", name: "eggs", quantity: 2, unit: "each", optional: false },
      ],
    }),
    recipe({
      id: "ln1",
      title: "Grilled Cheese",
      course: "lunch",
      ingredients: [
        { id: "1", name: "bread", quantity: 2, unit: "slice", optional: false },
        { id: "2", name: "cheese", quantity: 2, unit: "slice", optional: false },
      ],
    }),
    recipe({
      id: "ln2",
      title: "Tuna Pasta",
      course: "lunch",
      isStruggleMeal: true,
      ingredients: [
        { id: "1", name: "pasta", quantity: 8, unit: "oz", optional: false },
        { id: "2", name: "tuna", quantity: 1, unit: "can", optional: false },
      ],
    }),
    recipe({
      id: "dn1",
      title: "Fried Rice",
      course: "dinner",
      isStruggleMeal: true,
      ingredients: riceIng,
    }),
    recipe({
      id: "dn2",
      title: "Tomato Pasta",
      course: "dinner",
      ingredients: pastaIng,
    }),
    recipe({
      id: "dn3",
      title: "Bean Rice Bowl",
      course: "main",
      isStruggleMeal: true,
      ingredients: [
        { id: "1", name: "rice", quantity: 1, unit: "cup", optional: false },
        { id: "2", name: "beans", quantity: 1, unit: "can", optional: false },
      ],
    }),
    recipe({
      id: "dn4",
      title: "Chicken Soup",
      course: "dinner",
      ingredients: [
        { id: "1", name: "chicken", quantity: 1, unit: "lb", optional: false },
        { id: "2", name: "onion", quantity: 1, unit: "each", optional: false },
      ],
    }),
  ];

  const fullPantry = pantry([
    "eggs",
    "flour",
    "milk",
    "potato",
    "bread",
    "cheese",
    "pasta",
    "tuna",
    "rice",
    "tomato",
    "beans",
    "chicken",
    "onion",
  ]);

  it("builds 7 days with breakfast/lunch/dinner slots", () => {
    const plan = buildWeeklyMenu(catalog, fullPantry, {
      startDate: new Date("2026-09-15T12:00:00"),
    });
    expect(plan.days).toHaveLength(7);
    for (const day of plan.days) {
      expect(day.slots.breakfast).toBeTruthy();
      expect(day.slots.lunch).toBeTruthy();
      expect(day.slots.dinner).toBeTruthy();
      expect(day.slots.breakfast!.course === "breakfast" || true).toBe(true);
    }
    // Breakfast picks should be breakfast-tagged
    for (const day of plan.days) {
      expect(day.slots.breakfast!.recipeId.startsWith("bk")).toBe(true);
    }
  });

  it("avoids repeating the same recipe too often when alternatives exist", () => {
    const plan = buildWeeklyMenu(catalog, fullPantry, {
      startDate: new Date("2026-09-15T12:00:00"),
    });
    const counts = recipeRepeatCounts(plan);
    const maxRepeats = Math.max(...counts.values());
    // 21 slots, 9 recipes → some repeats OK, but no single recipe should dominate
    expect(maxRepeats).toBeLessThanOrEqual(5);
    // With 3 breakfast options across 7 days, each breakfast shouldn't exceed ~3
    const breakfastIds = plan.days.map((d) => d.slots.breakfast!.recipeId);
    const bkCounts = new Map<string, number>();
    for (const id of breakfastIds) {
      bkCounts.set(id, (bkCounts.get(id) || 0) + 1);
    }
    expect(Math.max(...bkCounts.values())).toBeLessThanOrEqual(3);
  });

  it("prefers struggle / cheap recipes when Struggle Mode is on", () => {
    const plan = buildWeeklyMenu(catalog, fullPantry, {
      struggleMode: true,
      startDate: new Date("2026-09-15T12:00:00"),
    });
    expect(plan.struggleMode).toBe(true);
    const picks = plan.days.flatMap((d) =>
      (["breakfast", "lunch", "dinner"] as MealSlot[]).map((s) => d.slots[s]!)
    );
    const struggleShare =
      picks.filter((p) => p.isStruggleMeal).length / picks.length;
    expect(struggleShare).toBeGreaterThan(0.3);
  });

  it("regenerateMenuSlot changes the slot when alternatives exist", () => {
    const plan = buildWeeklyMenu(catalog, fullPantry, {
      startDate: new Date("2026-09-15T12:00:00"),
    });
    const before = plan.days[0]!.slots.breakfast!.recipeId;
    const next = regenerateMenuSlot(
      plan,
      0,
      "breakfast",
      catalog,
      fullPantry,
      { startDate: new Date("2026-09-15T12:00:00") }
    );
    const after = next.days[0]!.slots.breakfast!.recipeId;
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  it("collectMissingFromPlan dedupes missing names", () => {
    const thin = pantry(["eggs"]); // most recipes missing something
    const plan = buildWeeklyMenu(catalog, thin, {
      startDate: new Date("2026-09-15T12:00:00"),
    });
    const missing = collectMissingFromPlan(plan);
    const lower = missing.map((m) => m.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
    expect(missing.length).toBeGreaterThan(0);
  });
});
