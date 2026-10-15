"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: unknown) {
  const r = await fetch("/api/admin/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

export function NutritionAdminActions() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-sage-600" data-testid="recompute-msg">{msg}</span>}
      <button type="button" className="btn-secondary text-sm" disabled={busy} data-testid="recompute"
        onClick={async () => { setBusy(true); const r = await post({ action: "recompute" }); setBusy(false); setMsg(r.ok ? `Recomputed ${r.json.recomputed}; ${r.json.trusted} trusted.` : r.json.error ?? "Failed"); router.refresh(); }}>
        Recompute all
      </button>
    </div>
  );
}

export function ServingsFlagButton({ recipeId, suspect, note }: { recipeId: string; suspect: boolean; note: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-1">
      {suspect && <div className="text-xs font-semibold text-ember-700" data-testid="servings-flagged">Needs review{note ? `: ${note}` : ""}</div>}
      <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={busy} data-testid="servings-toggle"
        onClick={async () => { setBusy(true); await post({ action: "servings", recipeId, suspect: !suspect, ...(suspect ? {} : { note: "Awaiting servings from the recipe owner" }) }); setBusy(false); router.refresh(); }}>
        {suspect ? "Clear review flag" : "Flag servings"}
      </button>
    </div>
  );
}
