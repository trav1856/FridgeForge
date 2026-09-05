"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CouponCode } from "./CouponCode";
import type { CouponDTO } from "@/lib/coupons";

type Props = { id: string };

export function CouponRedeem({ id }: Props) {
  const [coupon, setCoupon] = useState<CouponDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bright, setBright] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/coupons/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      setCoupon(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!bright) return;
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#ffffff";
    document.documentElement.classList.add("coupon-bright");
    return () => {
      document.body.style.backgroundColor = prev;
      document.documentElement.classList.remove("coupon-bright");
    };
  }, [bright]);

  async function markUsed() {
    if (!coupon) return;
    await fetch(`/api/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ used: true, clipped: true }),
    });
    await load();
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-600">{error}</p>
        <Link href="/coupons" className="btn-secondary mt-4 inline-flex">
          Back to coupons
        </Link>
      </div>
    );
  }

  if (!coupon) {
    return <p className="text-sm text-sage-600">Loading redeem view…</p>;
  }

  return (
    <div
      className={
        bright
          ? "mx-auto max-w-md space-y-5 rounded-3xl bg-white p-5 text-black shadow-card"
          : "mx-auto max-w-md space-y-5"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <Link href="/coupons" className="btn-ghost text-xs">
          ← Coupons
        </Link>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => setBright((v) => !v)}
        >
          {bright ? "Normal theme" : "Bright mode"}
        </button>
      </div>

      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">
          {coupon.brand}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-sage-900">
          {coupon.title}
        </h1>
        <p className="mt-3 text-5xl font-black leading-none tracking-tight text-sage-900 sm:text-6xl">
          {coupon.discountText}
        </p>
        {coupon.expiresAt && (
          <p className="mt-3 text-sm font-semibold text-sage-700">
            Expires {coupon.expiresAt.slice(0, 10)}
            {coupon.expired ? " · EXPIRED" : ""}
          </p>
        )}
        {coupon.used && (
          <p className="mt-1 text-sm font-bold text-ember-700">Marked used</p>
        )}
      </div>

      <div className="rounded-2xl border-2 border-dashed border-sage-300 bg-white p-4">
        <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider text-sage-500">
          Show at register · {coupon.codeType}
        </p>
        <CouponCode
          value={coupon.codeValue}
          codeType={coupon.codeType}
          size="lg"
        />
      </div>

      {coupon.terms && (
        <div className="rounded-xl bg-cream-100/80 p-3 text-xs leading-relaxed text-sage-700">
          <span className="font-bold uppercase tracking-wide text-sage-500">
            Terms ·{" "}
          </span>
          {coupon.terms}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!coupon.used && (
          <button type="button" className="btn-primary flex-1" onClick={() => void markUsed()}>
            Mark as used
          </button>
        )}
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() =>
            void fetch(`/api/coupons/${coupon.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clipped: !coupon.clipped }),
            }).then(load)
          }
        >
          {coupon.clipped ? "Unclip" : "Clip / save"}
        </button>
      </div>

      <p className="text-center text-[11px] text-sage-500">
        Demo codes only — not GS1 manufacturer coupons. Raise screen brightness
        for scanning.
      </p>
    </div>
  );
}
