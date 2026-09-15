"use client";

import { DIETARY_BADGE_FOOTNOTE } from "@/lib/dietary";

type Props = {
  kosherEligible?: boolean | null;
  halalEligible?: boolean | null;
  vegetarianEligible?: boolean | null;
  pescatarianEligible?: boolean | null;
  veganEligible?: boolean | null;
  /** Show the * footnote under badges (detail pages). */
  showFootnote?: boolean;
  className?: string;
};

/**
 * Show small dietary badges when eligible.
 * Kosher* / Halal* footnote: eligibility assumes certified ingredients.
 */
export function DietaryBadges({
  kosherEligible,
  halalEligible,
  vegetarianEligible,
  pescatarianEligible,
  veganEligible,
  showFootnote = false,
  className = "",
}: Props) {
  const showK = Boolean(kosherEligible);
  const showH = Boolean(halalEligible);
  const showVegan = Boolean(veganEligible);
  // Vegetarian implied by vegan — only show vegetarian if not vegan
  const showVeg = Boolean(vegetarianEligible) && !showVegan;
  const showPesc = Boolean(pescatarianEligible) && !showVeg && !showVegan;
  if (!showK && !showH && !showVegan && !showVeg && !showPesc) return null;

  return (
    <span className={className}>
      <span className="inline-flex flex-wrap gap-1.5">
        {showVegan && (
          <span className="badge bg-lime-100 text-lime-900" title="Vegan">
            Vegan
          </span>
        )}
        {showVeg && (
          <span
            className="badge bg-green-100 text-green-900"
            title="Vegetarian"
          >
            Vegetarian
          </span>
        )}
        {showPesc && (
          <span
            className="badge bg-teal-100 text-teal-900"
            title="Pescatarian"
          >
            Pescatarian
          </span>
        )}
        {showK && (
          <span
            className="badge bg-sky-100 text-sky-900"
            title={`${DIETARY_BADGE_FOOTNOTE} (not a certification claim)`}
          >
            Kosher*
          </span>
        )}
        {showH && (
          <span
            className="badge bg-emerald-100 text-emerald-900"
            title={`${DIETARY_BADGE_FOOTNOTE} (not a certification claim)`}
          >
            Halal*
          </span>
        )}
      </span>
      {showFootnote && (showK || showH) ? (
        <span className="mt-1 block text-[10px] leading-snug text-sage-500">
          * {DIETARY_BADGE_FOOTNOTE}. Seed/admin flags are heuristics, not
          rabbinic or certifying-body claims.
        </span>
      ) : null}
    </span>
  );
}
