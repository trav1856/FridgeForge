/** Day-filling + repair + swap for diet plans. Pure (no I/O); deterministic given a seed. */
import { DIET_TYPES, PORTIONS, dayCaps, mealRule, netCarbs, recipeAllowed, isRedMeat, type DietRecipe, type DietType, type MealMacros } from "@/lib/diet/rules";

export type PlanSlot = "breakfast" | "lunch" | "dinner" | "snack1" | "snack2";
export const SLOT_LABELS: Record<PlanSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack1: "Snack", snack2: "Snack 2" };

export function slotsFor(mealsPerDay: number): PlanSlot[] {
  if (mealsPerDay <= 2) return ["breakfast", "dinner"];
  if (mealsPerDay === 3) return ["breakfast", "lunch", "dinner"];
  if (mealsPerDay === 4) return ["breakfast", "lunch", "dinner", "snack1"];
  return ["breakfast", "lunch", "dinner", "snack1", "snack2"];
}

/** Share of the day's calories per slot. */
export function slotShares(slots: PlanSlot[]): Record<string, number> {
  const base: Record<PlanSlot, number> = slots.length === 2 ? { breakfast: 40, lunch: 0, dinner: 60, snack1: 0, snack2: 0 } : { breakfast: 25, lunch: 35, dinner: 40, snack1: 10, snack2: 10 };
  const snacks = slots.filter((s) => s.startsWith("snack")).length;
  const scale = (100 - snacks * 10) / 100;
  const out: Record<string, number> = {};
  for (const s of slots) out[s] = s.startsWith("snack") ? 10 : base[s] * scale;
  return out;
}

export type Candidate = DietRecipe & {
  course: string | null;
  tags: string[];
  dishKey: string | null;
  imageUrl: string | null;
  /** per serving */
  macros: MealMacros;
  trusted: boolean;
  /** 0..1 pantry match (bonus only) */
  pantryRatio?: number;
};

export type Settings = {
  dietType: DietType;
  kcalTarget: number;
  mealsPerDay: number;
  split: [number, number, number];
  tolerancePct: number;
};

export type PlannedMeal = {
  slot: PlanSlot;
  recipeId: string | null;
  title: string | null;
  imageUrl: string | null;
  portion: number;
  macros: MealMacros | null;
  locked: boolean;
  note?: string;
};
export type DayStatus = "ok" | "short" | "over" | "cap" | "empty";
export type PlannedDay = {
  dayIndex: number;
  dateISO: string;
  meals: PlannedMeal[];
  totals: MealMacros & { netCarbs: number };
  status: DayStatus;
  message: string | null;
};
export type DietWeekPlan = {
  version: 1;
  generatedAt: string;
  settings: Settings;
  days: PlannedDay[];
  poolSize: number;
  messages: string[];
};

const ZERO: MealMacros = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, saturatedFat: 0 };
const r1 = (n: number) => Math.round(n * 10) / 10;
export function scale(m: MealMacros, f: number): MealMacros {
  return { kcal: Math.round(m.kcal * f), protein: r1(m.protein * f), fat: r1(m.fat * f), carbs: r1(m.carbs * f), fiber: r1(m.fiber * f), saturatedFat: r1(m.saturatedFat * f) };
}
export function sum(ms: (MealMacros | null)[]): MealMacros & { netCarbs: number } {
  const t = { ...ZERO };
  for (const m of ms) if (m) { t.kcal += m.kcal; t.protein += m.protein; t.fat += m.fat; t.carbs += m.carbs; t.fiber += m.fiber; t.saturatedFat += m.saturatedFat; }
  const out = { kcal: Math.round(t.kcal), protein: r1(t.protein), fat: r1(t.fat), carbs: r1(t.carbs), fiber: r1(t.fiber), saturatedFat: r1(t.saturatedFat) };
  return { ...out, netCarbs: r1(netCarbs(out)) };
}

const BREAKFAST_RE = /\b(breakfast|brunch|pancakes?|waffles?|oatmeal|eggs?|omelet|toast|granola|smoothie|hash)\b/i;
export function fitsSlot(c: Candidate, slot: PlanSlot): boolean {
  const course = (c.course || "").toLowerCase();
  if (course === "dessert" || course === "drink") return false;
  if (slot === "breakfast") return course === "breakfast" || (!course && BREAKFAST_RE.test(`${c.title} ${c.tags.join(" ")}`));
  if (slot.startsWith("snack")) return course === "snack" || course === "side" || course === "starter" || course === "breakfast" || course === "lunch";
  return course !== "breakfast";
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

type Ctx = { settings: Settings; weekUse: Map<string, number>; redMeatMeals: number; rand: () => number };

/** Soft score for placing candidate×portion in a slot with a kcal budget (lower = better). */
function placementScore(c: Candidate, portion: number, budget: number, ctx: Ctx, dayIds: Set<string>): { score: number; macros: MealMacros } | null {
  if (!c.trusted || dayIds.has(c.id)) return null;
  const m = scale(c.macros, portion);
  const rule = mealRule(ctx.settings.dietType, m);
  if (!rule.ok) return null;
  const [p, cb, f] = ctx.settings.split;
  const kcal = Math.max(1, m.kcal);
  const splitErr = Math.abs((m.protein * 4) / kcal * 100 - p) + Math.abs((m.carbs * 4) / kcal * 100 - cb) + Math.abs((m.fat * 9) / kcal * 100 - f);
  let score = (Math.abs(m.kcal - budget) / Math.max(1, budget)) * 100 + splitErr * 0.3 + rule.penalty;
  score += (ctx.weekUse.get(c.id) ?? 0) * 12;
  if (portion !== 1) score += Math.abs(portion - 1) * 4; // prefer normal portions
  if (ctx.settings.dietType === "mediterranean" && isRedMeat(c) && ctx.redMeatMeals >= 2) score += 60;
  score -= (c.pantryRatio ?? 0) * 6;
  score += ctx.rand() * 4;
  return { score, macros: m };
}

function dayError(totals: MealMacros & { netCarbs: number }, s: Settings): number {
  const caps = dayCaps(s.dietType);
  let e = (Math.abs(totals.kcal - s.kcalTarget) / s.kcalTarget) * 100;
  if (caps.netCarbsMax != null && totals.netCarbs > caps.netCarbsMax) e += 50 + (totals.netCarbs - caps.netCarbsMax) * 3;
  if (caps.carbsMax != null && totals.carbs > caps.carbsMax) e += 50 + (totals.carbs - caps.carbsMax);
  return e;
}

export function describeDay(totals: MealMacros & { netCarbs: number }, meals: PlannedMeal[], s: Settings): { status: DayStatus; message: string | null } {
  const label = DIET_TYPES.find((d) => d.id === s.dietType)?.label ?? s.dietType;
  const empty = meals.filter((m) => !m.recipeId);
  if (empty.length === meals.length) return { status: "empty", message: `No ${label.toLowerCase()} recipes you can see fit these meals yet.` };
  const caps = dayCaps(s.dietType);
  if (caps.netCarbsMax != null && totals.netCarbs > caps.netCarbsMax) return { status: "cap", message: `Over the ${caps.netCarbsMax} g net-carb daily limit (${totals.netCarbs} g).` };
  if (caps.carbsMax != null && totals.carbs > caps.carbsMax) return { status: "cap", message: `Over the ${caps.carbsMax} g carb daily limit (${Math.round(totals.carbs)} g).` };
  const tol = (s.kcalTarget * s.tolerancePct) / 100;
  const diff = totals.kcal - s.kcalTarget;
  const gaps = empty.length ? ` No fitting recipe for: ${empty.map((m) => SLOT_LABELS[m.slot].toLowerCase()).join(", ")}.` : "";
  if (diff < -tol) return { status: "short", message: `Can't reach ${s.kcalTarget.toLocaleString()} kcal with ${label.toLowerCase()} recipes you can see: planned ${totals.kcal.toLocaleString()} (${diff.toLocaleString()}).${gaps}` };
  if (diff > tol) return { status: "over", message: `Can't stay under ${s.kcalTarget.toLocaleString()} kcal with ${label.toLowerCase()} recipes you can see: planned ${totals.kcal.toLocaleString()} (+${diff.toLocaleString()}).${gaps}` };
  return { status: "ok", message: gaps ? gaps.trim() : null };
}

/** Fill one day. Locked meals are kept as-is. */
export function fillDay(
  pool: Candidate[], s: Settings, dayIndex: number, dateISO: string,
  locked: PlannedMeal[] = [], weekUse = new Map<string, number>(), redMeatMeals = 0, seed = 1
): PlannedDay {
  const ctx: Ctx = { settings: s, weekUse, redMeatMeals, rand: rng(seed * 7919 + dayIndex * 104729) };
  const slots = slotsFor(s.mealsPerDay);
  const shares = slotShares(slots);
  const allowed = pool.filter((c) => recipeAllowed(s.dietType, c).ok);
  const meals: PlannedMeal[] = slots.map((slot) => {
    const l = locked.find((m) => m.slot === slot && m.locked && m.recipeId);
    return l ? { ...l } : { slot, recipeId: null, title: null, imageUrl: null, portion: 1, macros: null, locked: false };
  });
  const dayIds = () => new Set(meals.map((m) => m.recipeId).filter((x): x is string => Boolean(x)));
  const byId = new Map(allowed.map((c) => [c.id, c]));

  // 1. greedy fill with a running total; later slots aim at the remaining budget
  for (const meal of meals) {
    if (meal.recipeId) continue;
    const used = sum(meals.map((m) => m.macros)).kcal;
    const openShares = meals.filter((m) => !m.recipeId).reduce((a, m) => a + shares[m.slot]!, 0);
    const budget = Math.max(0, s.kcalTarget - used) * (shares[meal.slot]! / Math.max(1, openShares));
    let best: { c: Candidate; portion: number; score: number; macros: MealMacros } | null = null;
    const ids = dayIds();
    for (const c of allowed) {
      if (!fitsSlot(c, meal.slot)) continue;
      for (const portion of PORTIONS) {
        const p = placementScore(c, portion, budget, ctx, ids);
        if (p && (!best || p.score < best.score)) best = { c, portion, ...p };
      }
    }
    if (best) Object.assign(meal, { recipeId: best.c.id, title: best.c.title, imageUrl: best.c.imageUrl, portion: best.portion, macros: best.macros });
  }

  // 2. repair: single-slot swaps / portion changes that reduce the day error
  for (let iter = 0; iter < 50; iter++) {
    const totals = sum(meals.map((m) => m.macros));
    const err = dayError(totals, s);
    if (err <= s.tolerancePct && describeDay(totals, meals, s).status === "ok") break;
    let bestMove: { i: number; c: Candidate; portion: number; macros: MealMacros; err: number } | null = null;
    meals.forEach((meal, i) => {
      if (meal.locked) return;
      const others = meals.filter((_, j) => j !== i);
      const otherIds = new Set(others.map((m) => m.recipeId).filter((x): x is string => Boolean(x)));
      for (const c of allowed) {
        if (!fitsSlot(c, meal.slot) || !c.trusted || otherIds.has(c.id)) continue;
        for (const portion of PORTIONS) {
          const m = scale(c.macros, portion);
          if (!mealRule(s.dietType, m).ok) continue;
          const e = dayError(sum([...others.map((o) => o.macros), m]), s) + (weekUse.get(c.id) ?? 0) * 0.5;
          if (e < err - 0.01 && (!bestMove || e < bestMove.err)) bestMove = { i, c, portion, macros: m, err: e };
        }
      }
    });
    if (!bestMove) break;
    const mv = bestMove as { i: number; c: Candidate; portion: number; macros: MealMacros };
    Object.assign(meals[mv.i]!, { recipeId: mv.c.id, title: mv.c.title, imageUrl: mv.c.imageUrl, portion: mv.portion, macros: mv.macros });
  }

  for (const m of meals) if (m.recipeId && byId.has(m.recipeId)) weekUse.set(m.recipeId, (weekUse.get(m.recipeId) ?? 0) + 1);
  const totals = sum(meals.map((m) => m.macros));
  const d = describeDay(totals, meals, s);
  return { dayIndex, dateISO, meals, totals, status: d.status, message: d.message };
}

export function buildWeek(pool: Candidate[], s: Settings, startISO: string, seed = 1, previous?: DietWeekPlan | null): DietWeekPlan {
  const weekUse = new Map<string, number>();
  const byId = new Map(pool.map((c) => [c.id, c]));
  let redMeat = 0;
  const days: PlannedDay[] = [];
  const start = new Date(startISO + "T12:00:00Z");
  for (let i = 0; i < 7; i++) {
    const date = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    const locked = (previous?.days[i]?.meals ?? []).filter((m) => m.locked && m.recipeId && byId.has(m.recipeId))
      .map((m) => ({ ...m, macros: scale(byId.get(m.recipeId!)!.macros, m.portion) }));
    const day = fillDay(pool, s, i, date, locked, weekUse, redMeat, seed);
    redMeat += day.meals.filter((m) => m.recipeId && byId.get(m.recipeId) && isRedMeat(byId.get(m.recipeId)!)).length;
    days.push(day);
  }
  const messages: string[] = [];
  const trusted = pool.filter((c) => c.trusted && recipeAllowed(s.dietType, c).ok).length;
  if (trusted === 0) messages.push("None of the recipes you can see have trusted nutrition numbers for this diet yet.");
  return { version: 1, generatedAt: new Date().toISOString(), settings: s, days, poolSize: trusted, messages };
}

/** Recompute a day's totals/status after a manual change (swap, portion, lock). */
export function recomputeDay(day: PlannedDay, s: Settings): PlannedDay {
  const totals = sum(day.meals.map((m) => m.macros));
  const d = describeDay(totals, day.meals, s);
  return { ...day, totals, status: d.status, message: d.message };
}

export type Alternative = { recipeId: string; title: string; imageUrl: string | null; portion: number; macros: MealMacros; deltaKcal: number; deltaCarbs: number; deltaProtein: number; dayKcalAfter: number; fitsDay: boolean };

/** Top alternatives for one slot, with deltas against the current meal. */
export function alternatives(pool: Candidate[], s: Settings, day: PlannedDay, slot: PlanSlot, limit = 5): Alternative[] {
  const cur = day.meals.find((m) => m.slot === slot);
  const others = day.meals.filter((m) => m.slot !== slot);
  const otherIds = new Set(others.map((m) => m.recipeId).filter(Boolean));
  const out: (Alternative & { err: number })[] = [];
  for (const c of pool) {
    if (!c.trusted || c.id === cur?.recipeId || otherIds.has(c.id) || !fitsSlot(c, slot) || !recipeAllowed(s.dietType, c).ok) continue;
    let best: (Alternative & { err: number }) | null = null;
    for (const portion of PORTIONS) {
      const m = scale(c.macros, portion);
      if (!mealRule(s.dietType, m).ok) continue;
      const totals = sum([...others.map((o) => o.macros), m]);
      const err = dayError(totals, s) + Math.abs(portion - 1) * 2;
      if (!best || err < best.err) best = {
        recipeId: c.id, title: c.title, imageUrl: c.imageUrl, portion, macros: m,
        deltaKcal: m.kcal - (cur?.macros?.kcal ?? 0), deltaCarbs: r1(m.carbs - (cur?.macros?.carbs ?? 0)), deltaProtein: r1(m.protein - (cur?.macros?.protein ?? 0)),
        dayKcalAfter: totals.kcal, fitsDay: describeDay(totals, [...others, { slot, recipeId: c.id, title: c.title, imageUrl: null, portion, macros: m, locked: false }], s).status === "ok", err,
      };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => a.err - b.err).slice(0, limit).map(({ err: _e, ...a }) => a);
}
