"use client";

import Link from "next/link";
import { useStruggleMode } from "./StruggleModeProvider";

export function StruggleBanner() {
  const { struggleMode } = useStruggleMode();
  if (!struggleMode) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-ember-200 bg-gradient-to-r from-ember-50 to-cream-100 p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          💪
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-ember-900">
            Struggle Meal mode
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-sage-700">
            Rice, beans, eggs, pasta, canned goods — turned into food you&apos;re
            proud to plate. We prioritize cheap staples, technique tips, and
            flavor boosters (soy, vinegar, spices, citrus).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/struggle#budget-tips"
              className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-ember-800 ring-1 ring-ember-200 transition hover:bg-white"
            >
              Budget grocery tips
            </Link>
            <Link
              href="/struggle#kids-meals"
              className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-ember-800 ring-1 ring-ember-200 transition hover:bg-white"
            >
              Kids eat free / reduced
            </Link>
            <Link
              href="/struggle"
              className="rounded-full bg-ember-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-ember-700"
            >
              Struggle hub
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
