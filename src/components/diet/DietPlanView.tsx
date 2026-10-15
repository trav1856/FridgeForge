"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { dietLabel, PORTIONS } from "@/lib/diet/rules";
import { SLOT_LABELS, type Alternative, type DietWeekPlan, type PlannedDay, type PlannedMeal, type PlanSlot } from "@/lib/diet/planner";
import { DietDisclaimer } from "@/components/diet/DietDisclaimer";

type Settings = { dietType: string; kcalTarget: number; mealsPerDay: number; split: [number, number, number]; ageBand: string };
type Excluded = { allergens: number; prefs: number; untrusted: number };
const fmtPortion = (p: number) => ({ 0.5: "½", 0.75: "¾", 1: "1", 1.25: "1¼", 1.5: "1½", 2: "2" } as Record<number, string>)[p] ?? String(p);
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

function Bar({ value, max, over, testId }: { value: number; max: number; over?: boolean; testId?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return <div className="h-2 w-full rounded-full bg-cream-200" data-testid={testId}><div className={`h-2 rounded-full ${over ? "bg-ember-600" : "bg-sage-600"}`} style={{ width: `${pct}%` }} /></div>;
}

export function DietPlanView() {
  const [state, setState] = useState<"loading" | "signedout" | "nosettings" | "ready">("loading");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plan, setPlan] = useState<DietWeekPlan | null>(null);
  const [excluded, setExcluded] = useState<Excluded | null>(null);
  const [day, setDay] = useState(0);
  const [swap, setSwap] = useState<{ slot: PlanSlot; alts: Alternative[] | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/diet/plan", { cache: "no-store" }).then(async (r) => {
      if (r.status === 401) return setState("signedout");
      const x = await r.json();
      if (!x.settings) return setState("nosettings");
      setSettings(x.settings); setPlan(x.plan); setExcluded(x.excluded ?? null); setState("ready");
    }).catch(() => setErr("Couldn't load your plan."));
  }, []);

  const act = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/diet/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(x.error ?? "Something went wrong."); return null; }
      if (x.plan) setPlan(x.plan);
      if (x.excluded) setExcluded(x.excluded);
      return x;
    } finally { setBusy(false); }
  }, []);

  if (state === "loading") return <section className="card p-5 text-sm text-sage-600">Loading your diet plan…</section>;
  if (state === "signedout") return <section className="card space-y-2 p-5" data-testid="diet-signin"><h1 className="font-display text-2xl font-bold text-sage-900">Diet plan</h1><p className="text-sm text-sage-700">Sign in to plan your week around a diet type and a daily calorie target.</p><a href="/account" className="btn-primary inline-flex text-sm">Sign in</a></section>;
  if (state === "nosettings") return (
    <section className="card space-y-3 p-5 sm:p-6" data-testid="diet-empty">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">Diet plan</p>
      <h1 className="font-display text-3xl font-bold text-sage-900">Plan your week around a diet</h1>
      <p className="text-sm text-sage-700">Pick a diet type (balanced, keto, low-carb, high-protein, Mediterranean, vegetarian…) and a daily calorie target. We fill breakfast, lunch and dinner from your recipes with a running total, and you can swap or lock any meal.</p>
      <Link href="/menu/diet" className="btn-primary inline-flex" data-testid="diet-setup-cta">Set up my plan</Link>
      <DietDisclaimer compact />
    </section>
  );

  const s = settings!, p = plan!;
  const d: PlannedDay | undefined = p.days[day];
  const carbCap = s.dietType === "keto" ? 25 : s.dietType === "low_carb" ? 100 : null;

  async function openSwap(slot: PlanSlot) {
    setSwap({ slot, alts: null });
    const x = await act({ action: "alternatives", dayIndex: day, slot });
    setSwap(x ? { slot, alts: x.alternatives } : null);
  }

  return (
    <div className="space-y-4" data-testid="diet-plan">
      <section className="card space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">Diet plan</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-sage-900" data-testid="diet-summary">{dietLabel(s.dietType)} · {s.kcalTarget.toLocaleString()} kcal/day</h1>
            <p className="mt-1 text-sm text-sage-700">{s.mealsPerDay} meals a day · target split P {s.split[0]}% / C {s.split[1]}% / F {s.split[2]}% · {p.poolSize} recipes with trusted nutrition fit this diet.</p>
            {excluded && (excluded.allergens > 0 || excluded.prefs > 0) && (
              <p className="mt-1 text-xs text-sage-600" data-testid="diet-excluded">Left out: {excluded.allergens} for your allergies, {excluded.prefs} for your food preferences.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/menu/diet" className="btn-secondary text-sm" data-testid="diet-edit">Edit settings</Link>
            <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => act({ action: "regenerate" })} data-testid="diet-regenerate">Re-fill week (keeps locked)</button>
          </div>
        </div>
        {p.messages.map((m) => <p key={m} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="diet-week-message">{m}</p>)}
        {err && <p className="text-sm font-medium text-ember-700" data-testid="diet-action-error">{err}</p>}
      </section>

      <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Days" data-testid="diet-days">
        {p.days.map((x) => {
          const label = new Date(x.dateISO + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" });
          return (
            <button key={x.dayIndex} type="button" onClick={() => { setDay(x.dayIndex); setSwap(null); }} aria-pressed={day === x.dayIndex} data-testid={`day-tab-${x.dayIndex}`}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${day === x.dayIndex ? "border-ember-500 bg-ember-50" : "border-cream-300 bg-white"}`}>
              <div className="font-semibold text-sage-900">{label}</div>
              <div className={x.status === "ok" ? "text-sage-600" : "font-semibold text-ember-700"}>{x.totals.kcal.toLocaleString()} kcal{x.status === "ok" ? "" : " !"}</div>
            </button>
          );
        })}
      </nav>

      {d && (
        <section className="card space-y-4 p-4 sm:p-5" data-testid="diet-day">
          <div className="space-y-2" data-testid="day-totals">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-sage-900">Day total</h2>
              <span className="text-sm text-sage-800" data-testid="day-kcal"><b>{d.totals.kcal.toLocaleString()}</b> / {s.kcalTarget.toLocaleString()} kcal</span>
            </div>
            <Bar value={d.totals.kcal} max={s.kcalTarget} over={d.totals.kcal > s.kcalTarget * 1.1} testId="kcal-bar" />
            <div className="grid grid-cols-3 gap-2 text-xs text-sage-700 sm:grid-cols-5">
              <span>Protein <b>{Math.round(d.totals.protein)} g</b></span>
              <span>Carbs <b>{Math.round(d.totals.carbs)} g</b></span>
              <span>Fat <b>{Math.round(d.totals.fat)} g</b></span>
              <span>Fiber <b>{Math.round(d.totals.fiber)} g</b></span>
              <span>Net carbs <b>{Math.round(d.totals.netCarbs)} g</b></span>
            </div>
            {carbCap != null && (
              <div data-testid="carb-meter">
                <div className="mb-1 text-xs text-sage-700">{s.dietType === "keto" ? `Net carbs ${Math.round(d.totals.netCarbs)} / ${carbCap} g` : `Carbs ${Math.round(d.totals.carbs)} / ${carbCap} g`}</div>
                <Bar value={s.dietType === "keto" ? d.totals.netCarbs : d.totals.carbs} max={carbCap} over={(s.dietType === "keto" ? d.totals.netCarbs : d.totals.carbs) > carbCap} />
              </div>
            )}
            {d.message && <p className={`rounded-xl p-3 text-sm ${d.status === "ok" ? "bg-cream-100 text-sage-800" : "bg-amber-50 text-amber-900"}`} data-testid="day-message">{d.message}</p>}
          </div>

          <ul className="divide-y divide-cream-200" data-testid="day-meals">
            {d.meals.map((m: PlannedMeal) => (
              <li key={m.slot} className="py-3" data-testid={`meal-${m.slot}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-ember-700">{SLOT_LABELS[m.slot]}</div>
                  <div className="min-w-0 flex-1">
                    {m.recipeId ? (
                      <>
                        <Link href={`/recipes/${m.recipeId}`} className="font-semibold text-sage-900 hover:underline" data-testid="meal-title">{m.title}</Link>
                        <div className="mt-0.5 text-xs text-sage-600" data-testid="meal-macros">{fmtPortion(m.portion)} serving{m.portion === 1 ? "" : "s"} · {m.macros?.kcal} kcal · P {Math.round(m.macros?.protein ?? 0)} g · C {Math.round(m.macros?.carbs ?? 0)} g · F {Math.round(m.macros?.fat ?? 0)} g</div>
                      </>
                    ) : <span className="text-sm text-sage-600" data-testid="meal-empty">No recipe fits this meal yet.</span>}
                  </div>
                  {m.recipeId && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-sage-700">Portion{" "}
                        <select className="input inline-block w-auto px-2 py-1 text-xs" value={m.portion} disabled={busy} data-testid="meal-portion"
                          onChange={(e) => act({ action: "portion", dayIndex: day, slot: m.slot, portion: Number(e.target.value) })}>
                          {PORTIONS.map((x) => <option key={x} value={x}>{fmtPortion(x)}×</option>)}
                        </select>
                      </label>
                      <button type="button" className={m.locked ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"} disabled={busy} aria-pressed={m.locked} data-testid="meal-lock"
                        onClick={() => act({ action: m.locked ? "unlock" : "lock", dayIndex: day, slot: m.slot })}>{m.locked ? "🔒 Locked" : "Lock"}</button>
                      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={busy} data-testid="meal-swap" onClick={() => openSwap(m.slot)}>Swap</button>
                    </div>
                  )}
                  {!m.recipeId && <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={busy} data-testid="meal-swap" onClick={() => openSwap(m.slot)}>Find one</button>}
                </div>
                {swap?.slot === m.slot && (
                  <div className="mt-3 rounded-xl border border-cream-300 bg-cream-50 p-3" data-testid="swap-sheet">
                    <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-sage-900">Swap {SLOT_LABELS[m.slot].toLowerCase()}</span><button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setSwap(null)}>Close</button></div>
                    {swap.alts === null ? <p className="text-xs text-sage-600">Finding options…</p> : swap.alts.length === 0 ? <p className="text-sm text-sage-700" data-testid="swap-none">No other recipe you can see fits this meal and your diet.</p> : (
                      <ul className="space-y-2">
                        {swap.alts.map((a) => (
                          <li key={a.recipeId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2" data-testid="swap-option">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-sage-900">{a.title} <span className="text-xs font-normal text-sage-600">({fmtPortion(a.portion)}×)</span></div>
                              <div className="text-xs text-sage-600"><span data-testid="swap-delta">{sign(a.deltaKcal)} kcal</span> · {sign(a.deltaCarbs)} g carbs · {sign(a.deltaProtein)} g protein · day → {a.dayKcalAfter.toLocaleString()} kcal{a.fitsDay ? " ✓" : ""}</div>
                            </div>
                            <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={busy} data-testid="swap-use"
                              onClick={async () => { const x = await act({ action: "swap", dayIndex: day, slot: m.slot, recipeId: a.recipeId, portion: a.portion }); if (x) setSwap(null); }}>Use</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <DietDisclaimer compact />
    </div>
  );
}
