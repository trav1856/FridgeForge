"use client";

import Link from "next/link";
import {
  dietConflictPills,
  type DietaryUserPrefs,
  type RecipeDietaryFields,
} from "@/lib/dietary";
import {
  allergenLabel,
  conflictingAllergens,
} from "@/lib/allergens";

type RecipeLike = RecipeDietaryFields & {
  id?: string;
  title?: string;
  allergenTags?: string[] | string | null;
};

type Similar = { id: string; title: string };

type Props = {
  recipe: RecipeLike;
  prefs: DietaryUserPrefs | null | undefined;
  /** Compact pills for cards; default detail callout. */
  compact?: boolean;
  similarEligible?: Similar[];
  className?: string;
};

/**
 * Private warnings for kosher/halal/allergen conflicts.
 * Renders nothing for guests or users without matching prefs/flags.
 */
export function PersonalDietChrome({
  recipe,
  prefs,
  compact = false,
  similarEligible,
  className = "",
}: Props) {
  const pills = dietConflictPills(recipe, prefs);
  const allergyHits = conflictingAllergens(recipe, prefs?.allergenFlags);
  if (!pills.length && !allergyHits.length && !(similarEligible?.length)) {
    return null;
  }

  if (compact) {
    return (
      <div
        className={`flex flex-wrap gap-1.5 ${className}`.trim()}
        data-testid="personal-diet-chrome"
      >
        {allergyHits.map((id) => (
          <span
            key={`a-${id}`}
            className="badge bg-red-100 text-red-900"
            title="Matches an allergen you flagged"
          >
            Allergy: {allergenLabel(id)}
          </span>
        ))}
        {pills.map((p) => (
          <span
            key={p.kind}
            className="badge bg-amber-100 text-amber-950"
            data-testid={`conflict-${p.kind}`}
          >
            {p.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`.trim()} data-testid="personal-diet-chrome">
      {allergyHits.length > 0 && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
          role="alert"
        >
          <div className="font-semibold">Allergy warning</div>
          <p className="mt-0.5 text-red-900">
            This recipe may contain:{" "}
            {allergyHits.map(allergenLabel).join(", ")}. Still shown so you can
            decide — FridgeForge does not hide recipes for allergens.
          </p>
        </div>
      )}
      {pills.length > 0 && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="note"
        >
          <div className="font-semibold">Personal diet note</div>
          <p className="mt-0.5">
            {pills.map((p) => p.label).join(" · ")}. Matching recipes still
            rank higher in Cook Now / Weekly; nothing is hard-hidden for
            kosher/halal prefs.
          </p>
        </div>
      )}
      {similarEligible && similarEligible.length > 0 && (
        <div className="rounded-xl border border-sage-200 bg-cream-50 px-4 py-3 text-sm">
          <div className="font-semibold text-sage-900">
            Similar recipes that fit your prefs
          </div>
          <ul className="mt-2 space-y-1">
            {similarEligible.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/recipes/${s.id}`}
                  className="font-medium text-ember-700 hover:underline"
                >
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
