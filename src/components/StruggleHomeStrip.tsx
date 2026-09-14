"use client";

import Link from "next/link";
import { useStruggleMode } from "./StruggleModeProvider";
import { STRUGGLE_SECTIONS } from "@/lib/struggle-content";

/** Home cards for Struggle resources — rendered only when Struggle Mode is on. */
export function StruggleHomeStrip() {
  const { struggleMode } = useStruggleMode();
  if (!struggleMode) return null;

  return (
    <section
      className="space-y-3"
      aria-label="Struggle Meal resources"
      data-testid="struggle-home-strip"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-sage-900">
          Struggle toolkit
        </h2>
        <Link
          href="/struggle"
          className="text-xs font-bold uppercase tracking-wide text-ember-700 hover:underline"
        >
          Open hub
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {STRUGGLE_SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className="card group flex gap-3 p-4 transition hover:shadow-card-hover"
          >
            <span className="text-2xl" aria-hidden>
              {s.icon}
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-sage-900 group-hover:text-ember-700">
                {s.title}
              </h3>
              <p className="mt-0.5 text-sm leading-relaxed text-sage-600">
                {s.blurb}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
