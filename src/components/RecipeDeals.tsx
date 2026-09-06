"use client";

import { useEffect, useState } from "react";
import { DealsBanner } from "./DealsBanner";
import { AddToShoppingList } from "./AddToShoppingList";
import type { DealCouponSummary } from "@/lib/deals";

type Props = { recipeId: string; recipeTitle?: string };

/**
 * Loads deals for a recipe detail page: missing vs pantry + active coupon matches.
 * Also offers "Send missing to shopping list".
 */
export function RecipeDeals({ recipeId, recipeTitle }: Props) {
  const [deals, setDeals] = useState<DealCouponSummary[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/suggestions/deals?recipeId=${encodeURIComponent(recipeId)}`
        );
        if (!res.ok) {
          if (!cancelled) {
            setDeals([]);
            setMissing([]);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setDeals(data.deals || []);
          setMissing(data.missingIngredients || []);
        }
      } catch {
        if (!cancelled) {
          setDeals([]);
          setMissing([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  if (deals === null) return null;
  if (deals.length === 0 && missing.length === 0) return null;

  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <div className="card border-cream-300 bg-cream-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-sage-500">
            Missing from pantry
          </div>
          <p className="mt-1 text-sm text-ember-800">{missing.join(", ")}</p>
          <AddToShoppingList
            className="mt-3"
            items={missing.map((name) => ({ name }))}
            recipeId={recipeId}
            recipeTitle={recipeTitle}
            label="Send to shopping list"
          />
        </div>
      )}
      {deals.length > 0 && <DealsBanner deals={deals} />}
    </div>
  );
}
