"use client";

import Link from "next/link";
import { useStruggleMode } from "./StruggleModeProvider";
import { KIDS_MEAL_CAVEATS } from "@/lib/struggle-content";
import type { StruggleResourceDTO } from "@/lib/struggle-resources";

type Props = {
  tips: StruggleResourceDTO[];
  kidsMeals: StruggleResourceDTO[];
};

/** Full Struggle hub body — content only when Struggle Mode is on. */
export function StruggleResources({ tips, kidsMeals }: Props) {
  const { struggleMode, setStruggleMode } = useStruggleMode();

  if (!struggleMode) {
    return (
      <div className="card space-y-4 p-6">
        <h1 className="font-display text-2xl font-bold text-sage-900">
          Struggle resources
        </h1>
        <p className="text-sm leading-relaxed text-sage-700">
          Budget grocery tips and kids-eat-free / reduced meal snapshots stay
          tucked away unless Struggle Meal mode is on — so the rest of the app
          stays uncluttered.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setStruggleMode(true)}
        >
          Turn on Struggle Meal mode
        </button>
        <p className="text-xs text-sage-500">
          Or use the toggle in the header anytime.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">
          Struggle Meal mode
        </p>
        <h1 className="font-display text-3xl font-bold text-sage-900">
          Stretch the budget
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-sage-700">
          Practical grocery habits and a snapshot of family restaurant deals.
          Tap a card for the fuller write-up. No lectures — just options when
          money is tight.
        </p>
      </header>

      <section id="budget-tips" className="scroll-mt-28 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-sage-900">
            Budget grocery tips
          </h2>
          <span className="badge bg-ember-100 text-ember-800">Shopping</span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {tips.map((tip) => (
            <li key={tip.id}>
              <Link
                href={`/struggle/${tip.slug}`}
                className="card block h-full p-4 transition hover:shadow-card-hover"
              >
                <h3 className="font-display text-lg font-bold text-sage-900">
                  {tip.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-sage-700">
                  {tip.summary}
                </p>
                <span className="mt-2 inline-block text-xs font-bold text-ember-700">
                  Read more →
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {tips.length === 0 && (
          <p className="text-sm text-sage-600">No tips published yet.</p>
        )}
      </section>

      <section id="kids-meals" className="scroll-mt-28 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-sage-900">
            Kids eat free / reduced
          </h2>
          <span className="badge bg-sage-100 text-sage-700">US chains</span>
        </div>

        <div className="rounded-2xl border border-ember-200 bg-ember-50/80 px-4 py-3 text-sm text-ember-900">
          <p className="font-semibold">Before you go</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ember-900/90">
            {KIDS_MEAL_CAVEATS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {kidsMeals.map((d) => (
            <li key={d.id}>
              <Link
                href={`/struggle/${d.slug}`}
                className="card block h-full p-4 transition hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-sage-900">
                    {d.title}
                  </h3>
                  {d.whenLabel && (
                    <span className="badge shrink-0 bg-cream-200 text-sage-800">
                      {d.whenLabel}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-sage-700">
                  {d.summary}
                </p>
                <span className="mt-2 inline-block text-xs font-bold text-ember-700">
                  Details →
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {kidsMeals.length === 0 && (
          <p className="text-sm text-sage-600">No kids-meal deals published yet.</p>
        )}
      </section>

      <p className="text-center text-xs text-sage-500">
        <Link href="/" className="font-medium text-ember-700 underline">
          Back home
        </Link>
        {" · "}
        Turn Struggle Meal mode off anytime from the header.
      </p>
    </div>
  );
}
