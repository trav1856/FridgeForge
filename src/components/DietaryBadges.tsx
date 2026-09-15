"use client";

import { DIETARY_BADGE_FOOTNOTE } from "@/lib/dietary";

type Props = {
  kosherEligible?: boolean | null;
  halalEligible?: boolean | null;
  /** Show the * footnote under badges (detail pages). */
  showFootnote?: boolean;
  className?: string;
};

/**
 * Always show small Kosher* / Halal* badges when eligible, regardless of prefs.
 * Footnote: eligibility assumes certified ingredients — not a certification claim.
 */
export function DietaryBadges({
  kosherEligible,
  halalEligible,
  showFootnote = false,
  className = "",
}: Props) {
  const showK = Boolean(kosherEligible);
  const showH = Boolean(halalEligible);
  if (!showK && !showH) return null;

  return (
    <span className={className}>
      <span className="inline-flex flex-wrap gap-1.5">
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
      {showFootnote ? (
        <span className="mt-1 block text-[10px] leading-snug text-sage-500">
          * {DIETARY_BADGE_FOOTNOTE}. Seed/admin flags are heuristics, not
          rabbinic or certifying-body claims.
        </span>
      ) : null}
    </span>
  );
}
