"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStruggleMode } from "./StruggleModeProvider";
import { StruggleBanner } from "./StruggleBanner";
import { RecipeImage } from "./RecipeImage";
import { DietaryBadges } from "./DietaryBadges";
import { AddToShoppingList } from "./AddToShoppingList";
import type {
  MealSlot,
  MenuSlotPick,
  WeeklyMenuPlanData,
} from "@/lib/weekly-menu";
import { MEAL_SLOTS } from "@/lib/weekly-menu";

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function WeeklyMenuView() {
  const { struggleMode } = useStruggleMode();
  const [plan, setPlan] = useState<WeeklyMenuPlanData | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [pantryCount, setPantryCount] = useState(0);
  const [persisted, setPersisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyPayload = useCallback(
    (data: {
      plan?: WeeklyMenuPlanData;
      missing?: string[];
      pantryCount?: number;
      persisted?: boolean;
      error?: string;
    }) => {
      if (data.error) {
        setError(typeof data.error === "string" ? data.error : "Failed");
        return;
      }
      if (data.plan) setPlan(data.plan);
      setMissing(Array.isArray(data.missing) ? data.missing : []);
      setPantryCount(
        typeof data.pantryCount === "number" ? data.pantryCount : 0
      );
      setPersisted(Boolean(data.persisted));
      setError(null);
    },
    []
  );

  const load = useCallback(
    async (opts?: { regenerate?: boolean }) => {
      setLoading(true);
      setBusyKey(opts?.regenerate ? "week" : null);
      try {
        const params = new URLSearchParams({
          struggle: struggleMode ? "1" : "0",
        });
        if (opts?.regenerate) params.set("regenerate", "1");
        const res = await fetch(`/api/weekly-menu?${params.toString()}`);
        const data = await res.json();
        applyPayload(data);
      } catch {
        setError("Could not load weekly menu");
      } finally {
        setLoading(false);
        setBusyKey(null);
      }
    },
    [struggleMode, applyPayload]
  );

  useEffect(() => {
    load();
  }, [load]);

  const regenerateWeek = useCallback(async () => {
    setBusyKey("week");
    try {
      const res = await fetch("/api/weekly-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          struggleMode,
        }),
      });
      const data = await res.json();
      applyPayload(data);
    } catch {
      setError("Could not regenerate week");
    } finally {
      setBusyKey(null);
    }
  }, [struggleMode, applyPayload]);

  const regenerateSlot = useCallback(
    async (dayIndex: number, slot: MealSlot) => {
      const key = `${dayIndex}-${slot}`;
      setBusyKey(key);
      try {
        const res = await fetch("/api/weekly-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "regenerateSlot",
            struggleMode,
            dayIndex,
            slot,
            plan,
          }),
        });
        const data = await res.json();
        applyPayload(data);
      } catch {
        setError("Could not refresh that meal");
      } finally {
        setBusyKey(null);
      }
    },
    [struggleMode, plan, applyPayload]
  );

  const regenerateDay = useCallback(
    async (dayIndex: number) => {
      const key = `day-${dayIndex}`;
      setBusyKey(key);
      try {
        const res = await fetch("/api/weekly-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "regenerateDay",
            struggleMode,
            dayIndex,
            plan,
          }),
        });
        const data = await res.json();
        applyPayload(data);
      } catch {
        setError("Could not regenerate that day");
      } finally {
        setBusyKey(null);
      }
    },
    [struggleMode, plan, applyPayload]
  );

  const shoppingItems = useMemo(
    () => missing.map((name) => ({ name })),
    [missing]
  );

  return (
    <div className="space-y-6">
      <StruggleBanner />

      <section className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">
              Menu planner
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold text-sage-900">
              Build me a menu for the next week
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sage-700">
              Breakfast, lunch, and dinner for seven days — picked from recipes
              you can mostly make with your active pantry
              {pantryCount > 0 ? ` (${pantryCount} items)` : ""}. Missing
              staples show lightly, same idea as Cook Now.
              {struggleMode
                ? " Struggle Meal Mode is on — favoring budget / struggle recipes."
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={regenerateWeek}
              disabled={loading || busyKey === "week"}
              className="btn-primary text-sm disabled:opacity-60"
            >
              {busyKey === "week" ? "Building…" : "Regenerate week"}
            </button>
            <Link href="/suggestions" className="btn-secondary text-sm">
              Cook Now
            </Link>
          </div>
        </div>

        {persisted && (
          <p className="text-xs text-sage-500">
            Plan saved for this household — refresh won&apos;t wipe it until you
            regenerate.
          </p>
        )}
        {!persisted && plan && (
          <p className="text-xs text-sage-500">
            Guest session — plan stays for this visit; sign in to persist.
          </p>
        )}

        {shoppingItems.length > 0 && (
          <div className="rounded-2xl border border-cream-300 bg-cream-50/80 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sage-500">
              Missing across the week ({shoppingItems.length})
            </div>
            <p className="mb-2 text-sm text-sage-700">
              {shoppingItems
                .slice(0, 12)
                .map((i) => i.name)
                .join(", ")}
              {shoppingItems.length > 12
                ? ` +${shoppingItems.length - 12} more`
                : ""}
            </p>
            <AddToShoppingList
              items={shoppingItems}
              label="Send missing to shopping list"
            />
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-ember-50 px-3 py-2 text-sm text-ember-800">
            {error}
          </p>
        )}
      </section>

      {loading && !plan ? (
        <p className="text-sm text-sage-600">Building your week…</p>
      ) : !plan ? (
        <p className="text-sm text-sage-600">
          No plan yet. Add pantry items and recipes, then regenerate.
        </p>
      ) : (
        <div className="space-y-4">
          {plan.days.map((day) => (
            <section key={day.dateISO} className="card overflow-hidden p-0">
              <div className="flex items-center justify-between gap-2 border-b border-cream-300/80 bg-sage-800 px-4 py-2.5 text-cream-50">
                <div className="font-display text-lg font-bold">
                  {day.dayLabel}
                  <span className="ml-2 text-sm font-medium text-cream-200">
                    {day.dateISO}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => regenerateDay(day.dayIndex)}
                  disabled={busyKey === `day-${day.dayIndex}` || busyKey === "week"}
                  className="rounded-lg bg-cream-50/10 px-2.5 py-1 text-[11px] font-semibold text-cream-50 hover:bg-cream-50/20 disabled:opacity-50"
                  title="Rebuild breakfast, lunch, and dinner for this day"
                >
                  {busyKey === `day-${day.dayIndex}`
                    ? "Refreshing…"
                    : "Regenerate day"}
                </button>
              </div>
              <div className="grid gap-0 sm:grid-cols-3">
                {MEAL_SLOTS.map((slot) => (
                  <SlotCard
                    key={slot}
                    slot={slot}
                    pick={day.slots[slot]}
                    busy={busyKey === `${day.dayIndex}-${slot}`}
                    onRegenerate={() => regenerateSlot(day.dayIndex, slot)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  pick,
  busy,
  onRegenerate,
}: {
  slot: MealSlot;
  pick: MenuSlotPick | null;
  busy: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex flex-col border-cream-300/80 p-4 sm:border-r sm:last:border-r-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-sage-500">
          {SLOT_LABEL[slot]}
        </span>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border border-ember-200 bg-ember-50 px-2 py-0.5 text-[11px] font-semibold text-ember-800 shadow-sm hover:bg-ember-100 disabled:opacity-50"
          title="Pick a different recipe for this meal"
          aria-label={`Regenerate ${SLOT_LABEL[slot]}`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.6-6.3" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          {busy ? "…" : "Regenerate"}
        </button>
      </div>

      {!pick ? (
        <p className="text-sm text-sage-500">No match — add recipes or pantry.</p>
      ) : (
        <>
          <Link href={`/recipes/${pick.recipeId}`} className="group block">
            <RecipeImage src={pick.imageUrl} alt={pick.title} />
            <h3 className="mt-2 font-display text-base font-bold leading-snug text-sage-900 group-hover:text-ember-700">
              {pick.title}
            </h3>
            <p className="mt-0.5 text-xs text-sage-600">
              {pick.canMakeNow
                ? "Ready from pantry"
                : pick.nearMiss
                  ? "Near miss"
                  : "Partial match"}
              {pick.cookTimeMinutes != null
                ? ` · ${pick.cookTimeMinutes} min`
                : ""}
              {pick.isStruggleMeal ? " · struggle" : ""}
            </p>
            <div className="mt-1">
              <DietaryBadges
                kosherEligible={pick.kosherEligible}
                halalEligible={pick.halalEligible}
                vegetarianEligible={pick.vegetarianEligible}
                pescatarianEligible={pick.pescatarianEligible}
                veganEligible={pick.veganEligible}
              />
            </div>
          </Link>
          {pick.missingIngredients.length > 0 && (
            <p className="mt-2 text-xs text-sage-500">
              Missing:{" "}
              <span className="text-sage-700">
                {pick.missingIngredients.slice(0, 4).join(", ")}
                {pick.missingIngredients.length > 4
                  ? ` +${pick.missingIngredients.length - 4}`
                  : ""}
              </span>
            </p>
          )}
          {pick.missingIngredients.length > 0 && (
            <div className="mt-2">
              <AddToShoppingList
                items={pick.missingIngredients.map((name) => ({ name }))}
                recipeId={pick.recipeId}
                recipeTitle={pick.title}
                label="Add missing"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
