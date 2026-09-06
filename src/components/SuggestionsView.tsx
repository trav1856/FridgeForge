"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useStruggleMode } from "./StruggleModeProvider";
import { StruggleBanner } from "./StruggleBanner";
import { DealsBanner } from "./DealsBanner";
import { RecipeImage } from "./RecipeImage";
import type { DealCouponSummary } from "@/lib/deals";
import { MOODS, pickSurprise, type MoodId } from "@/lib/moods";

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
    cookTimeMinutes?: number | null;
    imageUrl?: string | null;
    techniqueTips: string[];
    flavorBoosters: string[];
  };
};

const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any", value: null },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
];

function timeHeadline(maxMinutes: number | null): string {
  if (maxMinutes == null) return "What can you cook?";
  return `I’ve got ${maxMinutes} minutes — what can I make?`;
}

export function SuggestionsView() {
  const { struggleMode } = useStruggleMode();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pantryCount, setPantryCount] = useState(0);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [mood, setMood] = useState<MoodId>("any");
  const [tonightPickId, setTonightPickId] = useState<string | null>(null);
  const [flashPick, setFlashPick] = useState(false);
  const lastSurpriseId = useRef<string | null>(null);
  const pickCardRef = useRef<HTMLLIElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setTonightPickId(null);
    const params = new URLSearchParams({
      struggle: struggleMode ? "1" : "0",
      maxMissing: "2",
    });
    if (maxMinutes != null) {
      params.set("maxMinutes", String(maxMinutes));
    }
    if (mood && mood !== "any") {
      params.set("mood", mood);
    }
    const res = await fetch(`/api/suggestions?${params.toString()}`);
    const data = await res.json();
    setSuggestions(data.suggestions || []);
    setPantryCount(data.pantryCount || 0);
    setLoading(false);
  }, [struggleMode, maxMinutes, mood]);

  useEffect(() => {
    load();
  }, [load]);

  const surpriseMe = useCallback(() => {
    const pick = pickSurprise(suggestions, lastSurpriseId.current);
    if (!pick) return;
    lastSurpriseId.current = pick.recipe.id;
    setTonightPickId(pick.recipe.id);
    setFlashPick(true);
    window.setTimeout(() => setFlashPick(false), 1200);
    // Scroll after paint so the highlighted card is mounted
    window.requestAnimationFrame(() => {
      pickCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [suggestions]);


  const now = suggestions.filter((s) => s.canMakeNow);
  const near = suggestions.filter((s) => !s.canMakeNow && s.nearMiss);
  const partial = suggestions.filter((s) => !s.canMakeNow && !s.nearMiss);
  const tonightPick = tonightPickId
    ? suggestions.find((s) => s.recipe.id === tonightPickId)
    : null;

  return (
    <div className="space-y-6">
      <StruggleBanner />

      <div className="card p-4 sm:p-5">
        <h1 className="font-display text-2xl font-bold text-sage-900">
          {timeHeadline(maxMinutes)}
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          Scored from your {pantryCount} pantry item
          {pantryCount === 1 ? "" : "s"} — match quality, affordability
          {struggleMode ? ", and struggle-meal priority" : ""}
          {maxMinutes != null ? ", and cook time" : ""}
          {mood !== "any" ? ", and mood" : ""}. Near-misses allow 1–2 cheap
          missing staples.
        </p>

        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sage-500">
            How much time do you have?
          </div>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((opt) => {
              const active = opt.value === maxMinutes;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setMaxMinutes(opt.value)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    active
                      ? "bg-sage-800 text-cream-50 shadow-sm"
                      : "bg-sage-100 text-sage-800 hover:bg-sage-200"
                  }`}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sage-500">
            What are you in the mood for?
          </div>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => {
              const active = m.id === mood;
              return (
                <button
                  key={m.id}
                  type="button"
                  title={m.hint}
                  onClick={() => setMood(m.id)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    active
                      ? m.id === "any"
                        ? "bg-sage-800 text-cream-50 shadow-sm"
                        : "bg-ember-600 text-white shadow-sm"
                      : "bg-cream-100 text-sage-800 hover:bg-cream-200 border border-cream-300/80"
                  }`}
                  aria-pressed={active}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={surpriseMe}
            disabled={loading || suggestions.length === 0}
            className="btn-primary px-5 py-3 text-base disabled:cursor-not-allowed"
          >
            ✨ Surprise Me
          </button>
          <span className="max-w-xs text-xs text-sage-500">
            Picks one random recipe from tonight’s filtered set (pantry + time +
            mood). Won’t repeat the same pick twice in a row when it can help it.
          </span>
        </div>
      </div>

      {tonightPick && (
        <div
          className={`card overflow-hidden border-ember-300 p-0 ring-2 ring-ember-400/70 transition ${
            flashPick ? "animate-pulse bg-ember-50/80" : "bg-cream-50"
          }`}
        >
          <div className="border-b border-ember-200/60 bg-ember-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
            Tonight’s pick
          </div>
          <div className="p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-sage-900">
                {tonightPick.recipe.title}
              </h2>
              <p className="mt-1 text-sm text-sage-600">
                {tonightPick.canMakeNow
                  ? "You can make this now."
                  : tonightPick.nearMiss
                    ? "Almost there — a cheap staple or two."
                    : "Partial pantry match."}
                {tonightPick.recipe.cookTimeMinutes != null
                  ? ` · ${tonightPick.recipe.cookTimeMinutes} min`
                  : ""}
              </p>
            </div>
            <div className="mt-3 flex gap-2 sm:mt-0">
              <Link
                href={`/recipes/${tonightPick.recipe.id}`}
                className="btn-primary"
              >
                Cook this
              </Link>
              <button
                type="button"
                onClick={surpriseMe}
                className="btn-secondary"
              >
                Try another
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-sage-600">Finding meals…</p>
      ) : suggestions.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sage-700">
            {mood !== "any"
              ? `No pantry matches for that mood${
                  maxMinutes != null
                    ? ` within ${maxMinutes} minutes`
                    : ""
                }. Try another mood or clear it with Any.`
              : maxMinutes != null
                ? `No pantry matches that cook in ${maxMinutes} minutes or less. Try a longer window or add quicker recipes.`
                : "No strong matches yet. Add pantry staples or recipes to get suggestions."}
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
          <Section
            title="Make right now"
            items={now}
            empty="Nothing fully matched — check near-misses."
            highlightId={tonightPickId}
            flash={flashPick}
            pickCardRef={pickCardRef}
          />
          <Section
            title="Almost there (1–2 cheap staples)"
            items={near}
            empty="No near-misses."
            highlightId={tonightPickId}
            flash={flashPick}
            pickCardRef={pickCardRef}
          />
          {partial.length > 0 && (
            <Section
              title="Partial matches"
              items={partial}
              empty=""
              highlightId={tonightPickId}
              flash={flashPick}
              pickCardRef={pickCardRef}
            />
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
  highlightId,
  flash,
  pickCardRef,
}: {
  title: string;
  items: Suggestion[];
  empty: string;
  highlightId: string | null;
  flash: boolean;
  pickCardRef: MutableRefObject<HTMLLIElement | null>;
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
          {items.map((s) => {
            const isPick = highlightId === s.recipe.id;
            return (
              <li
                key={s.recipe.id}
                ref={isPick ? pickCardRef : undefined}
                className={`card overflow-hidden p-0 transition ${
                  isPick
                    ? `ring-2 ring-ember-500 ${
                        flash ? "animate-pulse bg-ember-50/60" : "bg-cream-50"
                      }`
                    : ""
                }`}
              >
                <RecipeImage
                  src={s.recipe.imageUrl}
                  alt={s.recipe.title}
                  className="rounded-none rounded-t-xl"
                />
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        {isPick && (
                          <span className="badge bg-ember-600 text-white">
                            Tonight’s pick
                          </span>
                        )}
                        <span className="badge bg-sage-800 text-cream-50">
                          score {Math.round(s.score)}
                        </span>
                        <span className="badge bg-sage-100 text-sage-800">
                          {Math.round(s.matchRatio * 100)}% match
                        </span>
                        {s.recipe.cookTimeMinutes != null && (
                          <span className="badge bg-cream-100 text-sage-800">
                            {s.recipe.cookTimeMinutes} min
                          </span>
                        )}
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
                      <p
                        className={
                          s.missingCount ? "text-ember-800" : "text-sage-800"
                        }
                      >
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
            );
          })}
        </ul>
      )}
    </section>
  );
}
