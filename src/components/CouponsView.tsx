"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import type { CouponDTO } from "@/lib/coupons";

type Filter = "all" | "active" | "clipped" | "expired" | "used";

export function CouponsView() {
  const [items, setItems] = useState<CouponDTO[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coupons?filter=${filter}`);
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load");
      setItems(data);
    } catch {
      setError("Could not load coupons");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError("Update failed");
      return;
    }
    await load();
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "clipped", label: "Clipped" },
    { id: "expired", label: "Expired" },
    { id: "used", label: "Used" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-2xl bg-sage-100/70 p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={clsx(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                filter === f.id
                  ? "bg-white text-sage-900 shadow-sm"
                  : "text-sage-600 hover:text-sage-900"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link href="/coupons/new" className="btn-secondary text-xs">
          Create demo coupon
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-sage-600">Loading coupons…</p>
      ) : items.length === 0 ? (
        <p className="card p-6 text-center text-sage-600">
          No coupons in this filter. Seed data or create a demo coupon.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="card overflow-hidden">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-ember-700">
                    {c.brand}
                  </div>
                  <Link
                    href={`/coupons/${c.id}`}
                    className="font-display text-lg font-bold text-sage-900 hover:text-ember-700"
                  >
                    {c.title}
                  </Link>
                  <div className="mt-1 text-2xl font-bold text-sage-900">
                    {c.discountText}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-sage-600">
                    <span
                      className={clsx(
                        "badge",
                        c.status === "active" && "bg-sage-100 text-sage-800",
                        c.status === "expired" && "bg-cream-200 text-sage-600",
                        c.status === "used" && "bg-ember-100 text-ember-800"
                      )}
                    >
                      {c.status}
                    </span>
                    {c.clipped && (
                      <span className="badge bg-ember-50 text-ember-700">
                        clipped
                      </span>
                    )}
                    {c.expiresAt && (
                      <span>
                        exp {c.expiresAt.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                  <Link href={`/coupons/${c.id}`} className="btn-primary text-xs">
                    Redeem view
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => void patch(c.id, { clipped: !c.clipped })}
                  >
                    {c.clipped ? "Unclip" : "Clip / save"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => void patch(c.id, { used: !c.used })}
                  >
                    {c.used ? "Mark unused" : "Mark used"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
