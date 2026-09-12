"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeChip } from "@/components/BadgeChip";
import type { HowToBadgeDTO } from "@/lib/howto";

type BadgeRow = HowToBadgeDTO & { awardedAt: string };

export function HowToBadgesPanel() {
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/howto/badges")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.signedIn) {
          if (!cancelled) setBadges([]);
          return;
        }
        setBadges(data.badges ?? []);
      })
      .catch(() => {
        if (!cancelled) setBadges([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (badges === null) {
    return (
      <div className="card p-5 text-sm text-sage-600">Loading badges…</div>
    );
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-sage-900">
          How-to badges
        </h2>
        <Link
          href="/howto"
          className="text-xs font-semibold uppercase tracking-wide text-ember-700 hover:underline"
        >
          Open How-to
        </Link>
      </div>
      {badges.length === 0 ? (
        <p className="text-sm text-sage-600">
          No badges yet. Finish a cooking basics course in How-to to earn your
          first one.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <BadgeChip key={b.id} badge={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
