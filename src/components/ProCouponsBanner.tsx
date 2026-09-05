"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Soft upsell when signed-in plan is community (demo coupons remain). */
export function ProCouponsBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const user = data?.user;
        const live = data?.features?.liveCoupons;
        // Show for guests and community; hide for pro
        setShow(!live);
      })
      .catch(() => {
        if (!cancelled) setShow(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="mb-4 rounded-2xl border border-ember-200/80 bg-gradient-to-r from-ember-50 to-cream-50 px-4 py-3 text-sm text-sage-800">
      <span className="font-semibold text-ember-800">Pro unlocks live manufacturer deals.</span>{" "}
      Demo coupons below stay free.{" "}
      <Link href="/account" className="font-semibold text-ember-700 underline-offset-2 hover:underline">
        View account / plan
      </Link>
    </div>
  );
}
