"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DealsBanner } from "./DealsBanner";
import { AddToShoppingList } from "./AddToShoppingList";
import type { DealCouponSummary } from "@/lib/deals";
import { DEMO_PANTRY_LABEL, toCalcPantry } from "@/lib/demo-pantry";
import { useDemoPantry } from "@/lib/demo-pantry-store";
import { useViewer } from "@/lib/viewer-client";

type Props = { recipeId: string; recipeTitle?: string };

type DealsState = {
  deals: DealCouponSummary[];
  missing: string[];
  canMakeNow: boolean;
  pantryCount: number;
};

/**
 * Recipe detail: pantry check (missing vs. "you have enough"), coupon matches,
 * and "Send missing to shopping list". Guests are checked against their
 * browser-only demo pantry through a read-only POST.
 */
export function RecipeDeals({ recipeId, recipeTitle }: Props) {
  const viewer = useViewer();
  const demo = viewer != null && viewer.kind !== "member";
  const demoItems = useDemoPantry(demo);
  const [state, setState] = useState<DealsState | null>(null);

  useEffect(() => {
    if (viewer == null || (demo && demoItems == null)) return;
    let cancelled = false;
    const empty: DealsState = { deals: [], missing: [], canMakeNow: false, pantryCount: 0 };
    (async () => {
      try {
        const url = `/api/suggestions/deals?recipeId=${encodeURIComponent(recipeId)}`;
        const res = demo
          ? await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ recipeId, pantry: toCalcPantry(demoItems ?? []) }),
            })
          : await fetch(url);
        if (!res.ok) {
          if (!cancelled) setState(empty);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setState({
            deals: Array.isArray(data.deals) ? data.deals : [],
            missing: Array.isArray(data.missingIngredients) ? data.missingIngredients : [],
            canMakeNow: data.canMakeNow === true,
            pantryCount: Number(data.pantryCount) || 0,
          });
        }
      } catch {
        if (!cancelled) setState(empty);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId, viewer, demo, demoItems]);

  if (state === null) return null;
  const { deals, missing, canMakeNow, pantryCount } = state;
  const enough = canMakeNow && missing.length === 0 && pantryCount > 0;
  if (!enough && deals.length === 0 && missing.length === 0) return null;

  const demoTag = demo ? (
    <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
      {DEMO_PANTRY_LABEL}
    </span>
  ) : null;

  return (
    <div className="space-y-3">
      {enough && (
        <div
          className="card border-sage-300 bg-sage-50 p-4"
          role="status"
          data-testid="recipe-have-enough"
        >
          <p className="text-sm font-semibold text-sage-900">
            ✅ You have enough to make this{demo ? " (demo pantry)" : ""}.
            {demoTag}
          </p>
          {demo && (
            <p className="mt-1 text-xs text-sage-600">
              Checked against the demo pantry in this browser.{" "}
              <Link href="/account" className="underline">
                Sign in
              </Link>{" "}
              to check your own.
            </p>
          )}
        </div>
      )}
      {missing.length > 0 && (
        <div className="card border-cream-300 bg-cream-50 p-4" data-testid="recipe-missing">
          <div className="text-xs font-bold uppercase tracking-wide text-sage-500">
            Missing from {demo ? "the demo pantry" : "pantry"}
            {demoTag}
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
