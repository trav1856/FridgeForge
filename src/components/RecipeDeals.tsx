"use client";

import { useEffect, useState } from "react";
import { DealsBanner } from "./DealsBanner";
import type { DealCouponSummary } from "@/lib/deals";

type Props = { recipeId: string };

/**
 * Loads deals for a recipe detail page: missing vs pantry + active coupon matches.
 */
export function RecipeDeals({ recipeId }: Props) {
  const [deals, setDeals] = useState<DealCouponSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/suggestions/deals?recipeId=${encodeURIComponent(recipeId)}`
        );
        if (!res.ok) {
          if (!cancelled) setDeals([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setDeals(data.deals || []);
      } catch {
        if (!cancelled) setDeals([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  if (deals === null || deals.length === 0) return null;
  return <DealsBanner deals={deals} />;
}
