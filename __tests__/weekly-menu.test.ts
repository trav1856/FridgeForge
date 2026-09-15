import { describe, expect, it } from "vitest";
import {
  buildWeeklyMenu,
  collectMissingFromPlan,
  createRng,
  pickForSlot,
  recipeFitsMealSlot,
  recipeRepeatCounts,
  regenerateMenuDay,
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
  dishKey: partial.dishKey ?? null,
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

describe("pickForSlot unused-first / dishKey / randomize", () => {
  it("hard-prefers unused recipes even when the used one scores higher", () => {
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
    const pool: SuggestionResult[] = [
      { ...scoredA, score: 200 },
      { ...scoredB, score: 50 },
    ];
    const used = new Map<string, number>([["a", 1]]);
    const pick = pickForSlot(pool, used);
    expect(pick?.recipe.id).toBe("b");
  });

  it("hard-prefers unused dishKey when recipe ids are all fresh", () => {
    const a = recipe({
      id: "a1",
      title: "Classic Scramble",
      course: "breakfast",
      dishKey: "scramble",
      ingredients: eggIng,
    });
    const b = recipe({
      id: "b1",
      title: "Fancy Scramble",
      course: "breakfast",
      dishKey: "scramble",
      ingredients: eggIng,
    });
    const c = recipe({
      id: "c1",
      title: "Pancakes",
      course: "breakfast",
      dishKey: "pancakes",
      ingredients: eggIng,
    });
    const p = pantry(["eggs"]);
    const pool: SuggestionResult[] = [
      { ...scoreRecipe(a, p), score: 100 },
      { ...scoreRecipe(b, p), score: 99 },
      { ...scoreRecipe(c, p), score: 80 },
    ];
    const used = new Map<string, number>();
    const usedDishKeys = new Map<string, number>([["scramble", 1]]);
    const pick = pickForSlot(pool, used, { usedDishKeys });
    expect(pick?.recipe.id).toBe("c1");
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

  it("two regenerates with different rng can differ among top candidates", () => {
    const pool: SuggestionResult[] = [];
    const p = pantry(["eggs"]);
    for (let i = 0; i < 5; i++) {
      const r = recipe({
        id: `bk${i}`,
        title: `Breakfast ${i}`,
        course: "breakfast",
        ingredients: eggIng,
      });
      pool.push({ ...scoreRecipe(r, p), score: 100 - i });
    }
    const used = new Map<string, number>();
    const ids = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const pick = pickForSlot(pool, used, {
        randomize: true,
        rng: createRng(seed),
        topN: 5,
      });
      if (pick) ids.add(pick.recipe.id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("buildWeeklyMenu", () => {
  const catalog: RecipeForMatch[] = [
    recipe({
      id: "bk1",
      title: "Scrambled Eggs",
      course: "breakfast",
      tags: ["breakfast"],
      dishKey: "scramble",
      ingredients: eggIng,
      isStruggleMeal: true,
    }),
    recipe({
      id: "bk2",
      title: "Pancakes",
      course: "breakfast",
      tags: ["breakfast"],
      dishKey: "pancakes",
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
      dishKey: "hash",
      ingredients: [
        { id: "1", name: "potato", quantity: 2, unit: "each", optional: false },
        { id: "2", name: "eggs", quantity: 2, unit: "each", optional: false },
      ],
    }),
    recipe({
      id: "ln1",
      title: "Grilled Cheese",
      course: "lunch",
      dishKey: "grilled-cheese",
      ingredients: [
        { id: "1", name: "bread", quantity: 2, unit: "slice", optional: false },
        { id: "2", name: "cheese", quantity: 2, unit: "slice", optional: false },
      ],
    }),
    recipe({
      id: "ln2",
      title: "Tuna Pasta",
      course: "lunch",
      dishKey: "tuna-pasta",
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
      dishKey: "fried-rice",
      isStruggleMeal: true,
      ingredients: riceIng,
    }),
    recipe({
      id: "dn2",
      title: "Tomato Pasta",
      course: "dinner",
      dishKey: "tomato-pasta",
      ingredients: pastaIng,
    }),
    recipe({
      id: "dn3",
      title: "Bean Rice Bowl",
      course: "main",
      dishKey: "bean-rice",
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
      dishKey: "chicken-soup",
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

  /** Large breakfast pool (≥7) for repeat-cap assertions. */
  const largeBreakfastCatalog: RecipeForMatch[] = [
    ...catalog,
    ...Array.from({ length: 6 }, (_, i) =>
      recipe({
        id: `bkX${i}`,
        title: `Breakfast Extra ${i}`,
        course: "breakfast",
        dishKey: `bk-extra-${i}`,
        ingredients: eggIng,
      })
    ),
    ...Array.from({ length: 6 }, (_, i) =>
      recipe({
        id: `lnX${i}`,
        title: `Lunch Extra ${i}`,
        course: "lunch",
        dishKey: `ln-extra-${i}`,
        ingredients: [
          { id: "1", name: "bread", quantity: 2, unit: "slice", optional: false },
          { id: "2", name: "cheese", quantity: 1, unit: "slice", optional: false },
        ],
      })
    ),
    ...Array.from({ length: 6 }, (_, i) =>
      recipe({
        id: `dnX${i}`,
        title: `Dinner Extra ${i}`,
        course: "dinner",
        dishKey: `dn-extra-${i}`,
        ingredients: riceIng,
      })
    ),
  ];

  it("builds 7 days with breakfast/lunch/dinner slots", () => {
    const plan = buildWeeklyMenu(catalog, fullPantry, {
      startDate: new Date("2026-09-15T12:00:00"),
    });
    expect(plan.days).toHaveLength(7);
    for (const day of plan.days) {
      expect(day.slots.breakfast).toBeTruthy();
      expect(day.slots.lunch).toBeTruthy();
      expect(day.slots.dinner).toBeTruthy();
    }
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
    expect(maxRepeats).toBeLessThanOrEqual(5);
    const breakfastIds = plan.days.map((d) => d.slots.breakfast!.recipeId);
    const bkCounts = new Map<string, number>();
    for (const id of breakfastIds) {
      bkCounts.set(id, (bkCounts.get(id) || 0) + 1);
    }
    expect(Math.max(...bkCounts.values())).toBeLessThanOrEqual(3);
  });

  it("keeps max recipe repeats ≤2 across 7 days when pool is large enough", () => {
    const plan = buildWeeklyMenu(largeBreakfastCatalog, fullPantry, {
      startDate: new Date("2026-09-15T12:00:00"),
      randomize: true,
      rng: createRng(42),
    });
    const counts = recipeRepeatCounts(plan);
    const maxRepeats = Math.max(...counts.values());
    expect(maxRepeats).toBeLessThanOrEqual(2);

    const breakfastIds = plan.days.map((d) => d.slots.breakfast!.recipeId);
    // No same breakfast 3 days in a row when ≥3 options exist
    for (let i = 0; i < breakfastIds.length - 2; i++) {
      const a = breakfastIds[i];
      const b = breakfastIds[i + 1];
      const c = breakfastIds[i + 2];
      expect(!(a === b && b === c)).toBe(true);
    }
  });

  it("two randomized week builds with different seeds can differ", () => {
    const a = buildWeeklyMenu(largeBreakfastCatalog, fullPantry, {
      startDate: new Date("2026-09-15T12:00:00"),
      randomize: true,
      rng: createRng(11),
    });
    const b = buildWeeklyMenu(largeBreakfastCatalog, fullPantry, {
      startDate: new Date("2026-09-15T12:00:00"),
      randomize: true,
      rng: createRng(99),
    });
    const ids = (plan: typeof a) =>
      plan.days.flatMap((d) =>
        (["breakfast", "lunch", "dinner"] as MealSlot[]).map(
          (s) => d.slots[s]!.recipeId
        )
      );
    expect(ids(a)).not.toEqual(ids(b));
  });

  it("only uses isStruggleMeal recipes when Struggle Mode is on", () => {
    const plan = buildWeeklyMenu(catalog, fullPantry, {
      struggleMode: true,
      startDate: new Date("2026-09-15T12:00:00"),
    });
    expect(plan.struggleMode).toBe(true);
    const picks = plan.days.flatMap((d) =>
      (["breakfast", "lunch", "dinner"] as MealSlot[])
        .map((s) => d.slots[s])
        .filter((p): p is NonNullable<typeof p> => p != null)
    );
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((p) => p.isStruggleMeal)).toBe(true);
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
      {
        startDate: new Date("2026-09-15T12:00:00"),
        randomize: true,
        rng: createRng(7),
      }
    );
    const after = next.days[0]!.slots.breakfast!.recipeId;
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  it("regenerateMenuDay changes that day without wiping other days", () => {
    const plan = buildWeeklyMenu(largeBreakfastCatalog, fullPantry, {
      startDate: new Date("2026-09-15T12:00:00"),
      randomize: true,
      rng: createRng(3),
    });
    const otherBefore = plan.days.slice(1).map((d) => ({
      b: d.slots.breakfast!.recipeId,
      l: d.slots.lunch!.recipeId,
      d: d.slots.dinner!.recipeId,
    }));
    const day0Before = {
      b: plan.days[0]!.slots.breakfast!.recipeId,
      l: plan.days[0]!.slots.lunch!.recipeId,
      d: plan.days[0]!.slots.dinner!.recipeId,
    };
    const next = regenerateMenuDay(plan, 0, largeBreakfastCatalog, fullPantry, {
      randomize: true,
      rng: createRng(21),
    });
    const day0After = {
      b: next.days[0]!.slots.breakfast!.recipeId,
      l: next.days[0]!.slots.lunch!.recipeId,
      d: next.days[0]!.slots.dinner!.recipeId,
    };
    const otherAfter = next.days.slice(1).map((d) => ({
      b: d.slots.breakfast!.recipeId,
      l: d.slots.lunch!.recipeId,
      d: d.slots.dinner!.recipeId,
    }));
    expect(otherAfter).toEqual(otherBefore);
    // At least one of the three meals should change when pool is large
    expect(
      day0After.b !== day0Before.b ||
        day0After.l !== day0Before.l ||
        day0After.d !== day0Before.d
    ).toBe(true);
  });

  it("collectMissingFromPlan dedupes missing names", () => {
    const thin = pantry(["eggs"]);
    const plan = buildWeeklyMenu(catalog, thin, {
      startDate: new Date("2026-09-15T12:00:00"),
    });
    const missing = collectMissingFromPlan(plan);
    const lower = missing.map((m) => m.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
    expect(missing.length).toBeGreaterThan(0);
  });
});
