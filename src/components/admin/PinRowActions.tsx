"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jsonFetch } from "@/components/content/api";

export function PinRowActions({ pinId, first, last }: { pinId: string; first: boolean; last: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="ml-auto flex gap-1">
      <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={busy || first} aria-label="Move up" onClick={() => go(() => jsonFetch("/api/admin/pins", "PATCH", { pinId, dir: -1 }))}>↑</button>
      <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={busy || last} aria-label="Move down" onClick={() => go(() => jsonFetch("/api/admin/pins", "PATCH", { pinId, dir: 1 }))}>↓</button>
      <button type="button" className="btn-ghost px-2 py-1 text-xs text-red-700" disabled={busy} onClick={() => go(() => jsonFetch(`/api/admin/pins?pinId=${pinId}`, "DELETE"))}>Unpin</button>
    </span>
  );
}
