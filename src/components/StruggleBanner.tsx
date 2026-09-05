"use client";

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
        <div>
          <h2 className="font-display text-lg font-bold text-ember-900">
            Struggle Meal mode
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-sage-700">
            Rice, beans, eggs, pasta, canned goods — turned into food you&apos;re
            proud to plate. We prioritize cheap staples, technique tips, and
            flavor boosters (soy, vinegar, spices, citrus).
          </p>
        </div>
      </div>
    </div>
  );
}
