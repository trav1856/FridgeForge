"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jsonFetch } from "@/components/content/api";

export function PinToggle({ kind, refId, pinId }: { kind: "post" | "profile"; refId: string; pinId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn-ghost px-2 py-1 text-xs"
        disabled={busy}
        data-testid="pin-toggle"
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            if (pinId) await jsonFetch(`/api/admin/pins?pinId=${pinId}`, "DELETE");
            else await jsonFetch("/api/admin/pins", "POST", { kind, refId });
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {pinId ? "Unpin" : "Pin"}
      </button>
      {err && <span className="text-xs text-red-700">{err}</span>}
    </>
  );
}
