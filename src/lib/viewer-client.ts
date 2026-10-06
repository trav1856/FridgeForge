"use client";

import { useEffect, useState } from "react";

/**
 * Who is looking at the page, from /api/auth/me.
 * - guest: not signed in → demo pantry, local shopping list, sample coupons
 * - member: signed in with a household → server data
 * - no-household: signed in, no household yet (legacy) → server reads, writes blocked
 */
export type Viewer =
  | { kind: "guest" }
  | { kind: "member"; userId: string }
  | { kind: "no-household"; userId: string };

let inflight: { at: number; p: Promise<Viewer> } | null = null;

export function fetchViewer(): Promise<Viewer> {
  const now = Date.now();
  if (inflight && now - inflight.at < 3000) return inflight.p;
  const p = fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { user: null }))
    .then((data): Viewer => {
      const u = data?.user;
      if (!u?.id) return { kind: "guest" };
      return Array.isArray(u.households) && u.households.length > 0
        ? { kind: "member", userId: u.id }
        : { kind: "no-household", userId: u.id };
    })
    .catch((): Viewer => ({ kind: "guest" }));
  inflight = { at: now, p };
  return p;
}

/** null while loading. */
export function useViewer(): Viewer | null {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchViewer().then((v) => {
      if (!cancelled) setViewer(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return viewer;
}
