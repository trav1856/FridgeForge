"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  DIETARY_BADGE_FOOTNOTE,
  wantsHalalChrome,
  wantsKosherChrome,
  type DietaryUserPrefs,
} from "@/lib/dietary";
import { dietaryFilterHref } from "@/lib/recipe-filter-hrefs";

type Props = {
  kosherEligible?: boolean | null;
  halalEligible?: boolean | null;
  vegetarianEligible?: boolean | null;
  pescatarianEligible?: boolean | null;
  veganEligible?: boolean | null;
  carnivoreEligible?: boolean | null;
  atkinsEligible?: boolean | null;
  lowCarbEligible?: boolean | null;
  lowSugarEligible?: boolean | null;
  lowSodiumEligible?: boolean | null;
  /**
   * When set, Kosher* / Halal* badges only show for users with those personal prefs.
   * Guests / missing prefs → hide religion-diet badges (platform stays cuisine-first).
   */
  prefs?: DietaryUserPrefs | null;
  /** Show the * footnote under badges (detail pages). */
  showFootnote?: boolean;
  /** When true, badges link to /recipes?dietary=… */
  linkToFilters?: boolean;
  className?: string;
};

function Badge({
  href,
  className,
  title,
  children,
}: {
  href?: string | null;
  className: string;
  title: string;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className={`${className} hover:underline`} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <span className={className} title={title}>
      {children}
    </span>
  );
}

/**
 * Plant/macro badges are public. Kosher* / Halal* are prefs-gated personalization.
 */
export function DietaryBadges({
  kosherEligible,
  halalEligible,
  vegetarianEligible,
  pescatarianEligible,
  veganEligible,
  carnivoreEligible,
  atkinsEligible,
  lowCarbEligible,
  lowSugarEligible,
  lowSodiumEligible,
  prefs = null,
  showFootnote = false,
  linkToFilters = false,
  className = "",
}: Props) {
  const showK = Boolean(kosherEligible) && wantsKosherChrome(prefs);
  const showH = Boolean(halalEligible) && wantsHalalChrome(prefs);
  const showVegan = Boolean(veganEligible);
  const showVeg = Boolean(vegetarianEligible) && !showVegan;
  const showPesc = Boolean(pescatarianEligible) && !showVeg && !showVegan;
  const showCarnivore =
    Boolean(carnivoreEligible) && !showVegan && !showVeg && !showPesc;
  const showAtkins = Boolean(atkinsEligible);
  const showLowCarb = Boolean(lowCarbEligible);
  const showLowSugar = Boolean(lowSugarEligible);
  const showLowSodium = Boolean(lowSodiumEligible);
  if (
    !showK &&
    !showH &&
    !showVegan &&
    !showVeg &&
    !showPesc &&
    !showCarnivore &&
    !showAtkins &&
    !showLowCarb &&
    !showLowSugar &&
    !showLowSodium
  ) {
    return null;
  }

  const href = (dietary: string) =>
    linkToFilters ? dietaryFilterHref(dietary) : null;

  return (
    <span className={className}>
      <span className="inline-flex flex-wrap gap-1.5">
        {showVegan && (
          <Badge
            href={href("vegan")}
            className="badge bg-lime-100 text-lime-900"
            title="Vegan"
          >
            Vegan
          </Badge>
        )}
        {showVeg && (
          <Badge
            href={href("vegetarian")}
            className="badge bg-green-100 text-green-900"
            title="Vegetarian"
          >
            Vegetarian
          </Badge>
        )}
        {showPesc && (
          <Badge
            href={href("pescatarian")}
            className="badge bg-teal-100 text-teal-900"
            title="Pescatarian"
          >
            Pescatarian
          </Badge>
        )}
        {showCarnivore && (
          <Badge
            href={href("carnivore")}
            className="badge bg-rose-100 text-rose-900"
            title="Carnivore"
          >
            Carnivore
          </Badge>
        )}
        {showAtkins && (
          <Badge
            href={href("atkins")}
            className="badge bg-amber-100 text-amber-900"
            title="Atkins"
          >
            Atkins
          </Badge>
        )}
        {showLowCarb && (
          <Badge
            href={href("lowCarb")}
            className="badge bg-orange-100 text-orange-900"
            title="Low carb"
          >
            Low carb
          </Badge>
        )}
        {showLowSugar && (
          <Badge
            href={href("lowSugar")}
            className="badge bg-yellow-100 text-yellow-900"
            title="Low sugar"
          >
            Low sugar
          </Badge>
        )}
        {showLowSodium && (
          <Badge
            href={href("lowSodium")}
            className="badge bg-cyan-100 text-cyan-900"
            title="Low sodium"
          >
            Low sodium
          </Badge>
        )}
        {showK && (
          <Badge
            href={href("kosher")}
            className="badge bg-sky-100 text-sky-900"
            title={`${DIETARY_BADGE_FOOTNOTE} (not a certification claim)`}
          >
            Kosher*
          </Badge>
        )}
        {showH && (
          <Badge
            href={href("halal")}
            className="badge bg-emerald-100 text-emerald-900"
            title={`${DIETARY_BADGE_FOOTNOTE} (not a certification claim)`}
          >
            Halal*
          </Badge>
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
