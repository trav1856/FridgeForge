import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => {
  const settings = new Map<string, Record<string, unknown>>();
  const audit: Record<string, unknown>[] = [];
  const prisma: Record<string, unknown> = {
    userDietSettings: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => settings.get(where.userId) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: { userId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const row = { ...(settings.get(where.userId) ?? create), ...update }; settings.set(where.userId, row); return row;
      }),
    },
    adminAuditLog: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { audit.push(data); return data; }) },
  };
  return { prisma, settings, audit };
});
vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
type U = { id: string; role: string; disabled: boolean } | null;
const auth = vi.hoisted(() => ({ user: null as U }));
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => auth.user, resolveHouseholdId: async () => null }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { estimateRecipeNutrition, assessNutritionTrust, findNutritionEntry, quantityToGrams, riceIsRaw, scaleMacros } from "@/lib/recipe-nutrition";
import { mealRule, recipeAllowed, servingFit, dayCaps } from "@/lib/diet/rules";
import { alternatives, buildWeek, fillDay, slotShares, slotsFor, scale, type Candidate, type Settings } from "@/lib/diet/planner";
import { saveDietSettings, validateSettings } from "@/lib/diet/service";
import { buildSnapshot } from "@/lib/nutrition/snapshot";
import { DIET_DISCLAIMER } from "@/lib/diet/disclaimer";
import { GET as settingsGET, PUT as settingsPUT } from "@/app/api/diet/settings/route";
import { GET as planGET, POST as planPOST } from "@/app/api/diet/plan/route";
import { POST as nutritionPOST } from "@/app/api/admin/nutrition/route";

function req(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}
beforeEach(() => { auth.user = null; h.settings.clear(); h.audit.length = 0; });

describe("nutrition table + estimator fixes", () => {
  it("new ingredients are recognised", () => {
    for (const n of ["Whole chicken", "Ramen Noodles", "broccoli florets", "Banana", "Chocolate chips", "medium apples - peeled, cored and sliced", "canned pure pumpkin", "vegetable shortening", "hoisin sauce", "Sour cream", "Frozen peas", "Bell pepper", "ground cinnamon", "Baking powder", "Vanilla extract", "spicy kimchi, chopped"]) {
      expect(findNutritionEntry(n), n).not.toBeNull();
    }
    expect(findNutritionEntry("Bell pepper")!.key).toBe("bell pepper");
    expect(findNutritionEntry("Black pepper")!.key).toBe("pepper");
  });
  it("cans default to ~400 g, tuna/beans keep their can size; package needs a known size", () => {
    expect(quantityToGrams(2, "cans", findNutritionEntry("Canned diced tomatoes")!.entry)).toBe(800);
    expect(quantityToGrams(1, "can", findNutritionEntry("Canned tuna")!.entry)).toBe(140);
    expect(quantityToGrams(1, "package", findNutritionEntry("onion")!.entry)).toBeNull();
  });
  it("dry pasta by weight/package; cooked pasta by cup", () => {
    const dry = estimateRecipeNutrition([{ name: "Spaghetti", quantity: 8, unit: "oz" }], 1);
    expect(dry.lines[0]!.key).toBe("dry pasta");
    expect(dry.perServing.kcal).toBeGreaterThan(800);
    expect(estimateRecipeNutrition([{ name: "spaghetti", quantity: 1, unit: "package" }], 1).perServing.kcal).toBeGreaterThan(1600);
    expect(estimateRecipeNutrition([{ name: "Pasta", quantity: 1, unit: "cup" }], 1).lines[0]!.key).toBe("pasta");
  });
  it("raw vs cooked rice from name/steps; ambiguous assumes cooked and says so", () => {
    expect(riceIsRaw("White rice", { steps: '["Rinse 1 cup rice until clear"]' }).raw).toBe(true);
    expect(riceIsRaw("White rice", { steps: '["Add cold rice; break clumps"]' }).raw).toBe(false);
    expect(riceIsRaw("cold leftover white rice").raw).toBe(false);
    const amb = estimateRecipeNutrition([{ name: "White rice", quantity: 2, unit: "cups" }], 2, { context: { steps: '["Serve over rice"]' } });
    expect(amb.lines[0]!.key).toBe("rice");
    expect(amb.assumptions.join(" ")).toMatch(/assumed already cooked/);
    const raw = estimateRecipeNutrition([{ name: "White rice", quantity: 1, unit: "cups" }], 4, { context: { steps: '["Cook rice"]' } });
    expect(raw.lines[0]!.key).toBe("raw rice");
  });
  it("leading unit in the name is lifted (\"2 each tsp. sesame seeds\")", () => {
    const e = estimateRecipeNutrition([{ name: "tsp. toasted sesame seeds, divided", quantity: 2, unit: "each" }], 1);
    expect(e.lines[0]).toMatchObject({ matched: true, grams: 6 });
  });
  it("whole recipe always equals per-serving × servings (card toggle)", () => {
    const e = estimateRecipeNutrition([{ name: "Butter", quantity: 3, unit: "tbsp" }, { name: "Flour", quantity: 1.3, unit: "cups" }, { name: "egg", quantity: 1, unit: "each" }], 3);
    expect(e.total.kcal).toBe(Math.round(e.perServing.kcal * 3));
    expect(e.total.protein).toBe(Math.round(e.perServing.protein * 3));
    expect(e.total).toEqual(scaleMacros(e.perServing, 3));
  });
});

describe("trust", () => {
  const recipe = (ingredients: { name: string; quantity: number; unit: string }[], servings = 2) => ({ id: "r", title: "T", servings, steps: "[]", ingredients });
  it("major unmatched → untrusted; minor spices ok", () => {
    const ok = buildSnapshot(recipe([{ name: "Chicken breast", quantity: 1, unit: "lb" }, { name: "Mystery spice", quantity: 1, unit: "tsp" }]), false);
    expect(ok.trusted).toBe(true);
    const bad = buildSnapshot(recipe([{ name: "Chicken breast", quantity: 1, unit: "lb" }, { name: "Dragonfruit", quantity: 2, unit: "each" }]), false);
    expect(bad.trusted).toBe(false);
    expect(JSON.parse(bad.reasons).join()).toMatch(/Dragonfruit/);
  });
  it("servings flag and implausible kcal → untrusted", () => {
    expect(buildSnapshot(recipe([{ name: "Chicken breast", quantity: 1, unit: "lb" }]), true).trusted).toBe(false);
    const e = estimateRecipeNutrition([{ name: "oil", quantity: 2, unit: "cups" }], 1);
    expect(assessNutritionTrust(e).reasons.join()).toMatch(/implausibly high/);
    const lo = estimateRecipeNutrition([{ name: "salt", quantity: 1, unit: "tsp" }], 1);
    expect(assessNutritionTrust(lo).trusted).toBe(false);
  });
});

const M = (kcal: number, protein: number, carbs: number, fat: number, fiber = 0, saturatedFat = 0) => ({ kcal, protein, carbs, fat, fiber, saturatedFat });
const C = (id: string, course: string, macros: ReturnType<typeof M>, extra: Partial<Candidate> = {}): Candidate => ({
  id, title: id, course, tags: [], dishKey: null, imageUrl: null, ingredientNames: [id], vegetarianEligible: true, veganEligible: false, pescatarianEligible: true, trusted: true, macros, ...extra,
});
const S = (o: Partial<Settings> = {}): Settings => ({ dietType: "balanced", kcalTarget: 2000, mealsPerDay: 3, split: [25, 45, 30], tolerancePct: 10, ...o });

describe("diet rules", () => {
  it("keto: ≤10 g net carbs a meal, no grains; day cap 25", () => {
    expect(mealRule("keto", M(500, 30, 12, 40, 4)).ok).toBe(true); // 8 net
    expect(mealRule("keto", M(500, 30, 15, 40, 2)).ok).toBe(false);
    expect(recipeAllowed("keto", { ...C("x", "dinner", M(1, 1, 1, 1)), ingredientNames: ["White rice"] }).ok).toBe(false);
    expect(dayCaps("keto").netCarbsMax).toBe(25);
  });
  it("low-carb, high-protein, Mediterranean thresholds", () => {
    expect(mealRule("low_carb", M(500, 30, 31, 20)).ok).toBe(false);
    expect(mealRule("high_protein", M(400, 30, 20, 10)).ok).toBe(true);
    expect(mealRule("high_protein", M(800, 30, 80, 30)).ok).toBe(false);
    expect(mealRule("mediterranean", M(500, 20, 50, 20, 6, 8)).ok).toBe(false); // 14% sat fat
    expect(recipeAllowed("mediterranean", { ...C("x", "dinner", M(1, 1, 1, 1)), ingredientNames: ["Bacon"] }).ok).toBe(false);
  });
  it("vegetarian/vegan/pescatarian use recipe flags", () => {
    expect(servingFit("vegan", C("x", "dinner", M(400, 10, 50, 10)), M(400, 10, 50, 10)).ok).toBe(false);
  });
});

describe("planner", () => {
  it("slot shares sum to 100 for every meals-per-day", () => {
    for (const n of [2, 3, 4, 5]) expect(Object.values(slotShares(slotsFor(n))).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });
  const pool = [
    C("oats", "breakfast", M(300, 12, 45, 8)), C("eggs", "breakfast", M(250, 18, 2, 18)),
    C("soup", "lunch", M(350, 25, 30, 12)), C("salad", "lunch", M(450, 20, 40, 20)),
    C("pasta", "dinner", M(600, 22, 85, 15)), C("chicken", "dinner", M(550, 50, 10, 30)), C("curry", "dinner", M(700, 30, 70, 30)),
    C("cake", "dessert", M(500, 5, 70, 25)), C("untrusted", "dinner", M(800, 30, 60, 40), { trusted: false }),
  ];
  it("fills each slot, uses portions, lands within tolerance, never uses desserts/untrusted", () => {
    const d = fillDay(pool, S(), 0, "2026-10-15");
    expect(d.meals.map((m) => m.slot)).toEqual(["breakfast", "lunch", "dinner"]);
    expect(d.meals.every((m) => m.recipeId && !["cake", "untrusted"].includes(m.recipeId))).toBe(true);
    expect(Math.abs(d.totals.kcal - 2000)).toBeLessThanOrEqual(200);
    expect(d.status).toBe("ok");
    expect(d.totals.kcal).toBe(d.meals.reduce((a, m) => a + m.macros!.kcal, 0));
    for (const m of d.meals) expect(m.macros!.kcal).toBe(Math.round(pool.find((c) => c.id === m.recipeId)!.macros.kcal * m.portion));
  });
  it("honest message when the target can't be met", () => {
    const d = fillDay([C("eggs", "breakfast", M(250, 18, 2, 18))], S({ kcalTarget: 3000 }), 0, "2026-10-15");
    expect(d.status).toBe("short");
    expect(d.message).toMatch(/Can't reach 3,000 kcal/);
    expect(d.message).toMatch(/No fitting recipe for: lunch, dinner/);
    const none = fillDay([], S(), 0, "2026-10-15");
    expect(none.status).toBe("empty");
  });
  it("keto day respects the 25 g net-carb cap or says so", () => {
    const k = [C("eggs", "breakfast", M(300, 20, 3, 24)), C("steak", "dinner", M(700, 50, 2, 55)), C("tuna salad", "lunch", M(450, 35, 6, 32)), C("pasta", "dinner", M(600, 20, 80, 15))];
    const d = fillDay(k, S({ dietType: "keto", split: [20, 5, 75], kcalTarget: 1800 }), 0, "2026-10-15");
    expect(d.meals.some((m) => m.recipeId === "pasta")).toBe(false);
    expect(d.totals.netCarbs).toBeLessThanOrEqual(25);
  });
  it("week keeps locked meals and varies repeats", () => {
    const w = buildWeek(pool, S(), "2026-10-15", 1);
    expect(w.days).toHaveLength(7);
    w.days[2]!.meals[2]!.locked = true;
    const lockedId = w.days[2]!.meals[2]!.recipeId;
    const w2 = buildWeek(pool, S(), "2026-10-15", 99, w);
    expect(w2.days[2]!.meals[2]).toMatchObject({ recipeId: lockedId, locked: true });
    const dinners = new Set(w.days.map((d) => d.meals[2]!.recipeId));
    expect(dinners.size).toBeGreaterThan(1);
  });
  it("alternatives show deltas vs the current meal and exclude same-day repeats", () => {
    const d = fillDay(pool, S(), 0, "2026-10-15");
    const cur = d.meals[2]!;
    const alts = alternatives(pool, S(), d, "dinner");
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.some((a) => a.recipeId === cur.recipeId)).toBe(false);
    for (const a of alts) expect(a.deltaKcal).toBe(a.macros.kcal - cur.macros!.kcal);
    expect(scale(M(333, 10, 10, 10), 1.5).kcal).toBe(500);
  });
});

describe("settings validation", () => {
  it("minors: balanced only, ≥1600 kcal; adults ≥1200; split sums to 100", () => {
    expect(() => validateSettings({ dietType: "keto", kcalTarget: 2000, mealsPerDay: 3 }, "minor")).toThrow(/balanced/);
    expect(() => validateSettings({ dietType: "balanced", kcalTarget: 1400, mealsPerDay: 3 }, "minor")).toThrow(/1,600/);
    expect(() => validateSettings({ dietType: "keto", kcalTarget: 1100, mealsPerDay: 3 }, "adult")).toThrow(/1,200/);
    expect(() => validateSettings({ dietType: "keto", kcalTarget: 1800, mealsPerDay: 3, split: [30, 30, 30] }, "adult")).toThrow(/100%/);
    expect(validateSettings({ dietType: "keto", kcalTarget: 1800, mealsPerDay: 3, split: [20, 5, 75] }, "adult").split).toEqual([20, 5, 75]);
    expect(validateSettings({ dietType: "balanced", kcalTarget: 2000, mealsPerDay: 3, split: [20, 5, 75] }, "minor").split).toBeNull();
  });
  it("age band from DOB once; DOB not stored", async () => {
    await expect(saveDietSettings("u1", { dietType: "keto", kcalTarget: 1800, mealsPerDay: 3 })).rejects.toThrow(/date of birth/);
    await expect(saveDietSettings("u1", { dietType: "keto", kcalTarget: 1800, mealsPerDay: 3, birthDate: "2011-01-01" }, new Date("2026-10-15"))).rejects.toThrow(/balanced/);
    const s = await saveDietSettings("u2", { dietType: "keto", kcalTarget: 1800, mealsPerDay: 3, birthDate: "1990-01-01" }, new Date("2026-10-15"));
    expect(s).toMatchObject({ dietType: "keto", ageBand: "adult" });
    expect(JSON.stringify(h.settings.get("u2"))).not.toContain("1990");
  });
  it("disclaimer text is present", () => { expect(DIET_DISCLAIMER).toMatch(/not medical or dietary advice/); });
});

describe("API guards", () => {
  it("guests get 401; cross-site blocked; non-admin 403 on admin nutrition", async () => {
    expect((await settingsGET()).status).toBe(401);
    expect((await settingsPUT(req("/api/diet/settings", "PUT", {}))).status).toBe(401);
    expect((await planGET()).status).toBe(401);
    expect((await planPOST(req("/api/diet/plan", "POST", { action: "build" }))).status).toBe(401);
    expect((await nutritionPOST(req("/api/admin/nutrition", "POST", { action: "recompute" }))).status).toBe(401);
    auth.user = { id: "u9", role: "user", disabled: false };
    expect((await settingsPUT(req("/api/diet/settings", "PUT", { dietType: "keto" }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await nutritionPOST(req("/api/admin/nutrition", "POST", { action: "recompute" }))).status).toBe(403);
    expect(h.audit).toHaveLength(0);
  });
  it("settings PUT requires the disclaimer", async () => {
    auth.user = { id: "u9", role: "user", disabled: false };
    expect((await settingsPUT(req("/api/diet/settings", "PUT", { dietType: "keto", kcalTarget: 1800, mealsPerDay: 3, birthDate: "1990-01-01" }))).status).toBe(400);
    expect((await settingsPUT(req("/api/diet/settings", "PUT", { dietType: "keto", kcalTarget: 1800, mealsPerDay: 3, birthDate: "1990-01-01", disclaimerAccepted: true }))).status).toBe(200);
  });
});
