/**
 * Build /recipes?... hrefs for taxonomy / dietary chips on recipe detail.
 * Only emits params the list + API already understand.
 */

import { ORIGIN_OPTIONS } from "@/lib/recipe-taxonomy";

export function recipesFilterHref(
  params: Record<string, string | null | undefined>
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `/recipes?${s}` : "/recipes";
}

export function cuisineFilterHref(cuisine: string): string {
  return recipesFilterHref({ cuisine });
}

export function courseFilterHref(course: string): string {
  return recipesFilterHref({ course });
}

export function foodCategoryFilterHref(foodCategory: string): string {
  return recipesFilterHref({ foodCategory });
}

/** meat + optional subtype, e.g. /recipes?foodCategory=meat&meatType=beef */
export function meatTypeFilterHref(meatType: string): string {
  return recipesFilterHref({ foodCategory: "meat", meatType });
}

export function originFilterHref(originId: string): string {
  return recipesFilterHref({ origin: originId });
}

export function costTierFilterHref(costTier: string): string {
  return recipesFilterHref({ costTier });
}

export function struggleFilterHref(): string {
  return recipesFilterHref({ struggle: "1" });
}

/** dietary=vegan|vegetarian|… — matches GET /api/recipes */
export function dietaryFilterHref(dietary: string): string {
  return recipesFilterHref({ dietary });
}

export function searchFilterHref(q: string): string {
  return recipesFilterHref({ q });
}

export function originChipLabel(originId: string): string {
  const hit = ORIGIN_OPTIONS.find(
    (o) => o.id === originId || o.id === originId.toLowerCase()
  );
  return hit?.label || originId;
}
