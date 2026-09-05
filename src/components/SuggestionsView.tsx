"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStruggleMode } from "./StruggleModeProvider";
import { StruggleBanner } from "./StruggleBanner";
import { DealsBanner } from "./DealsBanner";
import { RecipeImage } from "./RecipeImage";
import type { DealCouponSummary } from "@/lib/deals";

type Suggestion = {
  score: number;
  matchRatio: number;
  matchedIngredients: string[];
  missingIngredients: string[];
  missingCount: number;
  canMakeNow: boolean;
  nearMiss: boolean;
  creativeNote?: string;
  deals?: DealCouponSummary[];
  recipe: {
    id: string;
    title: string;
    description: string | null;
    costTier: string;
    isStruggleMeal: boolean;
    tags: string[];
    servings: number;
    imageUrl?: string | null;
    techniqueTips: string[];
    flavorBoosters: string[];
  };
};

export function SuggestionsView() {
  const { struggleMode } = useStruggleMode();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pantryCount, setPantryCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/suggestions?struggle=${struggleMode ? "1" : "0"}&maxMissing=2`
    );
    const data = await res.json();
    setSuggestions(data.suggestions || []);
    setPantryCount(data.pantryCount || 0);
    setLoading(false);
  }, [struggleMode]);

  useEffect(() => {
    load();
  }, [load]);

  const now = suggestions.filter((s) => s.canMakeNow);
  const near = suggestions.filter((s) => !s.canMakeNow && s.nearMiss);
  const partial = suggestions.filter((s) => !s.canMakeNow && !s.nearMiss);

  return (
    <div className="space-y-6">
      <StruggleBanner />

      <div className="card p-4 sm:p-5">
        <h1 className="font-display text-2xl font-bold text-sage-900">
          What can you cook?
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          Scored from your {pantryCount} pantry item
          {pantryCount === 1 ? "" : "s"} — match quality, affordability
          {struggleMode ? ", and struggle-meal priority" : ""}. Near-misses
          allow 1–2 cheap missing staples.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-sage-600">Finding meals…</p>
      ) : suggestions.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sage-700">
            No strong matches yet. Add pantry staples or recipes to get
            suggestions.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/pantry" className="btn-primary">
              Update pantry
            </Link>
            <Link href="/recipes" className="btn-secondary">
              Browse recipes
            </Link>
          </div>
        </div>
      ) : (
        <>
          <Section title="Make right now" items={now} empty="Nothing fully matched — check near-misses." />
          <Section
            title="Almost there (1–2 cheap staples)"
            items={near}
            empty="No near-misses."
          />
          {partial.length > 0 && (
            <Section title="Partial matches" items={partial} empty="" />
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: Suggestion[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold text-sage-800">
        {title}
      </h2>
      {items.length === 0 ? (
        empty ? (
          <p className="text-sm text-sage-500">{empty}</p>
        ) : null
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s.recipe.id} className="card overflow-hidden p-0">
              <RecipeImage
                src={s.recipe.imageUrl}
                alt={s.recipe.title}
                className="rounded-none rounded-t-xl"
              />
              <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    <span className="badge bg-sage-800 text-cream-50">
                      score {Math.round(s.score)}
                    </span>
                    <span className="badge bg-sage-100 text-sage-800">
                      {Math.round(s.matchRatio * 100)}% match
                    </span>
                    <span
                      className={`badge ${
                        s.recipe.costTier === "cheap"
                          ? "bg-sage-100 text-sage-800"
                          : "bg-ember-50 text-ember-800"
                      }`}
                    >
                      {s.recipe.costTier}
                    </span>
                    {s.recipe.isStruggleMeal && (
                      <span className="badge bg-ember-600 text-white">
                        struggle
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-bold text-sage-900">
                    <Link
                      href={`/recipes/${s.recipe.id}`}
                      className="hover:text-ember-700"
                    >
                      {s.recipe.title}
                    </Link>
                  </h3>
                  {s.recipe.description && (
                    <p className="mt-1 text-sm text-sage-600">
                      {s.recipe.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-sage-500">
                    You have
                  </div>
                  <p className="text-sage-800">
                    {s.matchedIngredients.join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-sage-500">
                    Missing
                  </div>
                  <p className={s.missingCount ? "text-ember-800" : "text-sage-800"}>
                    {s.missingIngredients.join(", ") || "Nothing — cook!"}
                  </p>
                </div>
              </div>

              {s.creativeNote && (
                <p className="mt-3 rounded-xl bg-cream-100 px-3 py-2 text-sm text-sage-800">
                  ✨ {s.creativeNote}
                </p>
              )}

              <DealsBanner deals={s.deals || []} compact />

              {s.recipe.flavorBoosters.length > 0 && (
                <p className="mt-2 text-xs text-sage-600">
                  <span className="font-semibold">Flavor boosters:</span>{" "}
                  {s.recipe.flavorBoosters.join(" · ")}
                </p>
              )}
              {s.recipe.techniqueTips.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-sage-600">
                  {s.recipe.techniqueTips.slice(0, 2).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
