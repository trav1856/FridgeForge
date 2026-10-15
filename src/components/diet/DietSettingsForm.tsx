"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DIET_TYPES, KCAL_MAX, KCAL_MIN_ADULT, KCAL_MIN_MINOR, MINOR_DIETS, defaultSplit, type DietType } from "@/lib/diet/rules";
import { DietDisclaimer } from "@/components/diet/DietDisclaimer";

type S = { dietType: DietType; kcalTarget: number; mealsPerDay: number; split: [number, number, number]; customSplit: boolean; ageBand: "adult" | "minor" };

export function DietSettingsForm() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [ageBand, setAgeBand] = useState<"adult" | "minor" | null>(null);
  const [dietType, setDietType] = useState<DietType>("balanced");
  const [kcal, setKcal] = useState("2000");
  const [meals, setMeals] = useState(3);
  const [custom, setCustom] = useState(false);
  const [split, setSplit] = useState<[number, number, number]>(defaultSplit("balanced"));
  const [accepted, setAccepted] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/diet/settings", { cache: "no-store" }).then(async (r) => {
      const x = (await r.json()) as { settings: S | null; signedIn?: boolean };
      if (x.signedIn === false) { setSignedOut(true); return; }
      const { settings } = x;
      if (settings) {
        setAgeBand(settings.ageBand); setDietType(settings.dietType); setKcal(String(settings.kcalTarget)); setMeals(settings.mealsPerDay);
        setCustom(settings.customSplit); setSplit(settings.split);
      }
    }).finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  if (signedOut) return <section className="card p-5 text-sm text-sage-700" data-testid="diet-signin">Sign in to set up a diet plan. <a href="/account" className="font-semibold text-ember-700 underline">Sign in</a></section>;

  const minor = ageBand === "minor";
  const types = DIET_TYPES.filter((d) => !minor || MINOR_DIETS.includes(d.id));
  const sum = split[0] + split[1] + split[2];
  const pick = (id: DietType) => { setDietType(id); if (!custom) setSplit(defaultSplit(id)); };

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/diet/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dietType, kcalTarget: Number(kcal) || 0, mealsPerDay: meals, split: custom && !minor ? split : null, disclaimerAccepted: accepted || undefined, ...(ageBand ? {} : { birthDate }) }),
      });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(x.error ?? "Couldn't save."); return; }
      await fetch("/api/diet/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "build" }) });
      router.push("/menu?mode=diet");
    } finally { setBusy(false); }
  }

  return (
    <section className="card space-y-5 p-5 sm:p-6" data-testid="diet-settings">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">Diet plan</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-sage-900">Set up your plan</h1>
        <p className="mt-1 text-sm text-sage-700">We fill each day from recipes you can see, using estimated nutrition. Your allergies and food preferences from your account always apply.</p>
      </div>

      <fieldset>
        <legend className="label">Diet type</legend>
        {minor && <p className="mb-2 text-xs text-sage-600" data-testid="diet-minor-note">Under-18 accounts get balanced plans.</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="diet-types">
          {types.map((d) => (
            <button key={d.id} type="button" onClick={() => pick(d.id)} aria-pressed={dietType === d.id} data-testid={`diet-${d.id}`}
              className={`rounded-2xl border p-3 text-left transition ${dietType === d.id ? "border-ember-500 bg-ember-50 ring-2 ring-ember-300" : "border-cream-300 bg-white hover:border-sage-400"}`}>
              <div className="font-semibold text-sage-900">{d.label}</div>
              <div className="mt-0.5 text-xs text-sage-600">{d.blurb}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Daily calories to plan around</span>
          <input className="input" type="number" inputMode="numeric" min={minor ? KCAL_MIN_MINOR : KCAL_MIN_ADULT} max={KCAL_MAX} step={50} value={kcal} onChange={(e) => setKcal(e.target.value)} data-testid="diet-kcal" />
          <span className="mt-1 block text-xs text-sage-600">{(minor ? KCAL_MIN_MINOR : KCAL_MIN_ADULT).toLocaleString()}–{KCAL_MAX.toLocaleString()} kcal. If you're unsure, ask a doctor or dietitian.</span>
        </label>
        <label className="block">
          <span className="label">Meals per day</span>
          <select className="input" value={meals} onChange={(e) => setMeals(Number(e.target.value))} data-testid="diet-meals">
            <option value={2}>2 (breakfast, dinner)</option>
            <option value={3}>3 (breakfast, lunch, dinner)</option>
            <option value={4}>4 (+ a snack)</option>
            <option value={5}>5 (+ two snacks)</option>
          </select>
        </label>
      </div>

      {!minor && (
        <div className="rounded-xl border border-cream-300 bg-cream-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
            <input type="checkbox" checked={custom} onChange={(e) => { setCustom(e.target.checked); if (!e.target.checked) setSplit(defaultSplit(dietType)); }} data-testid="diet-custom-split" />
            Custom macro split (optional)
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["Protein", "Carbs", "Fat"] as const).map((n, i) => (
              <label key={n} className="block text-xs text-sage-700">{n} %
                <input className="input mt-1" type="number" min={0} max={100} disabled={!custom} value={split[i]} data-testid={`split-${n.toLowerCase()}`}
                  onChange={(e) => { const v = [...split] as [number, number, number]; v[i] = Number(e.target.value) || 0; setSplit(v); }} />
              </label>
            ))}
          </div>
          <p className={`mt-1 text-xs ${sum === 100 ? "text-sage-600" : "font-medium text-ember-700"}`}>Total {sum}%{sum === 100 ? "" : " (must be 100%)"}</p>
        </div>
      )}

      {!ageBand && (
        <label className="block max-w-xs">
          <span className="label">Date of birth</span>
          <input className="input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} aria-label="Date of birth" data-testid="diet-dob" />
          <span className="mt-1 block text-xs text-sage-600">Checked once to pick suitable plans; not stored.</span>
        </label>
      )}

      <DietDisclaimer minor={minor} />
      <label className="flex items-start gap-2 text-sm text-sage-800">
        <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} data-testid="diet-accept" />
        I understand these are estimates and not medical advice.
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={busy || !accepted} data-testid="diet-save">{busy ? "Building…" : "Save and build my week"}</button>
        {err && <span className="text-sm font-medium text-ember-700" data-testid="diet-error">{err}</span>}
      </div>
    </section>
  );
}
