"use client";

import Link from "next/link";
import type { DealCouponSummary } from "@/lib/deals";

type Props = {
  deals: DealCouponSummary[];
  /** Compact strip for suggestion cards */
  compact?: boolean;
  className?: string;
};

/**
 * Friendly alert when missing recipe ingredients have matching active coupons.
 * Hidden when deals is empty (fully stocked or no coupon matches).
 */
export function DealsBanner({ deals, compact = false, className = "" }: Props) {
  if (!deals.length) return null;

  const count = deals.length;

  if (compact) {
    return (
      <div
        className={`mt-3 rounded-xl border border-ember-200 bg-gradient-to-r from-ember-50 to-cream-100 px-3 py-2.5 ${className}`}
        role="status"
      >
        <p className="text-sm font-semibold text-ember-900">
          You have {count} deal{count === 1 ? "" : "s"} available for this dish
        </p>
        <ul className="mt-1.5 space-y-1">
          {deals.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline gap-x-2 text-xs text-sage-800">
              <Link
                href={`/coupons/${d.id}`}
                className="font-semibold text-ember-700 hover:underline"
              >
                {d.brand}
              </Link>
              <span className="font-bold text-sage-900">{d.discountText}</span>
              <span className="text-sage-500">· {d.title}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <aside
      className={`overflow-hidden rounded-2xl border border-ember-200 bg-gradient-to-br from-ember-50 via-cream-50 to-sage-50 p-4 shadow-card sm:p-5 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          🏷️
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-ember-900">
            You have deals available for this dish
          </h2>
          <p className="mt-1 text-sm text-sage-700">
            {count} manufacturer coupon{count === 1 ? "" : "s"} match
            {count === 1 ? "es" : ""} ingredients you&apos;re missing — clip and
            redeem at the store.
          </p>
          <ul className="mt-3 space-y-2">
            {deals.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2.5 border border-cream-300/80"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sage-900">
                    {d.brand}{" "}
                    <span className="text-ember-700">{d.discountText}</span>
                  </div>
                  <div className="truncate text-xs text-sage-600">{d.title}</div>
                  {d.matchedIngredients.length > 0 && (
                    <div className="mt-0.5 text-xs text-sage-500">
                      For: {d.matchedIngredients.join(", ")}
                    </div>
                  )}
                </div>
                <Link
                  href={`/coupons/${d.id}`}
                  className="btn-primary shrink-0 px-3 py-1.5 text-xs"
                >
                  Redeem
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
