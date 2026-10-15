import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveHouseholdId } from "@/lib/auth";
import { requireProfileOwner } from "@/lib/profile-auth";
import { assertSameOrigin } from "@/lib/same-origin";
import { adminErrorResponse } from "@/lib/admin";
import { DietError, getDietSettings, getSavedPlan, isPortion, loadCandidates, newWeek, savePlan, toSettings } from "@/lib/diet/service";
import { dietPlanActionSchema } from "@/lib/diet/schema";
import { alternatives, recomputeDay, scale, type DietWeekPlan } from "@/lib/diet/planner";

export const dynamic = "force-dynamic";
const NS = { headers: { "Cache-Control": "no-store" } };

function settingsChanged(plan: DietWeekPlan, s: ReturnType<typeof toSettings>) {
  return JSON.stringify(plan.settings) !== JSON.stringify(s);
}

export async function GET() {
  const auth = await requireProfileOwner();
  if (!auth.ok) return NextResponse.json({ signedIn: false, settings: null, plan: null }, NS);
  const settings = await getDietSettings(auth.user.id);
  if (!settings) return NextResponse.json({ settings: null, plan: null }, NS);
  const householdId = await resolveHouseholdId();
  const { pool, excluded } = await loadCandidates(auth.user, householdId);
  let plan = await getSavedPlan(auth.user.id);
  const s = toSettings(settings);
  if (!plan || settingsChanged(plan, s)) {
    plan = newWeek(pool, s, 1, plan);
    await savePlan(auth.user.id, plan);
  }
  return NextResponse.json({ settings, plan, excluded }, NS);
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireProfileOwner();
    if (!auth.ok) return auth.res;
    const body = dietPlanActionSchema.parse(await req.json());
    const settings = await getDietSettings(auth.user.id);
    if (!settings) throw new DietError("Set up your diet plan first.", 409);
    const s = toSettings(settings);
    const householdId = await resolveHouseholdId();
    const { pool, excluded } = await loadCandidates(auth.user, householdId);
    const byId = new Map(pool.map((c) => [c.id, c]));
    let plan = await getSavedPlan(auth.user.id);

    if (body.action === "build" || body.action === "regenerate" || !plan || settingsChanged(plan, s)) {
      // regenerate keeps locked meals; seed varies so the week actually changes
      const seed = body.action === "regenerate" ? (Date.now() % 100000) + 2 : 1;
      plan = newWeek(pool, s, seed, body.action === "build" ? null : plan);
      if (body.action === "build" || body.action === "regenerate") { await savePlan(auth.user.id, plan); return NextResponse.json({ plan, excluded }, NS); }
    }
    if (body.dayIndex == null || !body.slot) throw new DietError("dayIndex and slot required");
    const day = plan.days[body.dayIndex];
    const meal = day?.meals.find((m) => m.slot === body.slot);
    if (!day || !meal) throw new DietError("That meal isn't in your plan.");

    if (body.action === "alternatives") {
      return NextResponse.json({ alternatives: alternatives(pool, s, day, body.slot) }, NS);
    }
    if (body.action === "lock" || body.action === "unlock") {
      if (!meal.recipeId) throw new DietError("Nothing to lock in this meal yet.");
      meal.locked = body.action === "lock";
    } else if (body.action === "portion") {
      if (!meal.recipeId || !isPortion(body.portion)) throw new DietError("Pick a portion between ½ and 2 servings.");
      const c = byId.get(meal.recipeId);
      if (!c) throw new DietError("That recipe is no longer available to you.");
      meal.portion = body.portion;
      meal.macros = scale(c.macros, body.portion);
    } else if (body.action === "swap") {
      const c = body.recipeId ? byId.get(body.recipeId) : undefined;
      if (!c || !c.trusted) throw new DietError("That recipe can't be used in a diet plan.");
      const ok = alternatives(pool, s, day, body.slot, 1000).find((a) => a.recipeId === c.id);
      if (!ok) throw new DietError("That recipe doesn't fit this meal or your diet.");
      const portion = isPortion(body.portion) ? body.portion : ok.portion;
      Object.assign(meal, { recipeId: c.id, title: c.title, imageUrl: c.imageUrl, portion, macros: scale(c.macros, portion) });
    }
    plan.days[body.dayIndex] = recomputeDay(day, s);
    await savePlan(auth.user.id, plan);
    return NextResponse.json({ plan, excluded }, NS);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (err instanceof DietError) return NextResponse.json({ error: err.message }, { status: err.status });
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("diet/plan POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
