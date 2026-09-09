"use client";

import { useCallback, useEffect, useState } from "react";

type Deduction = {
  name: string;
  unit: string;
  deductedQty: number;
  quantityAfter: number;
  lowStock?: boolean;
};

type Props = {
  recipeId: string;
};

export function CookRecipeToggle({ recipeId }: Props) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lowStock, setLowStock] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/recipes/${recipeId}/cook`);
      const data = await res.json();
      if (res.ok) {
        setActive(Boolean(data.active));
        setLowStock(
          Array.isArray(data.session?.lowStockMessages)
            ? data.session.lowStockMessages
            : []
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startCook() {
    if (busy) return;
    const ok = window.confirm(
      "Deduct ingredients from pantry? You can undo by unchecking this."
    );
    if (!ok) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/cook`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(typeof data.error === "string" ? data.error : "Could not cook");
        return;
      }
      setActive(true);
      const deducted: Deduction[] = Array.isArray(data.deducted)
        ? data.deducted
        : [];
      const lows: string[] = Array.isArray(data.lowStockMessages)
        ? data.lowStockMessages
        : [];
      setLowStock(lows);
      const parts = deducted.map(
        (d) =>
          `${d.name}: −${d.deductedQty} ${d.unit} → ${d.quantityAfter} ${d.unit}`
      );
      const summary =
        parts.length > 0
          ? `Deducted: ${parts.join("; ")}`
          : "No matching pantry items to deduct.";
      setToast(
        lows.length > 0 ? `${summary}. ${lows.join(" · ")}` : summary
      );
    } catch {
      setToast("Could not deduct from pantry");
    } finally {
      setBusy(false);
    }
  }

  async function cancelCook() {
    if (busy) return;
    const ok = window.confirm(
      "Cancel cooking and restore pantry amounts deducted for this cook?"
    );
    if (!ok) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/cook`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(
          typeof data.error === "string" ? data.error : "Could not restore"
        );
        return;
      }
      setActive(false);
      setLowStock([]);
      const n = data.summary?.restoredCount ?? 0;
      setToast(
        n > 0
          ? `Restored ${n} pantry item${n === 1 ? "" : "s"} from this cook.`
          : "Cook cancelled."
      );
    } catch {
      setToast("Could not restore pantry");
    } finally {
      setBusy(false);
    }
  }

  function onToggle() {
    if (loading || busy) return;
    if (active) void cancelCook();
    else void startCook();
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-sage-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-sage-300 text-ember-600 focus:ring-ember-500"
          checked={active}
          disabled={loading || busy}
          onChange={onToggle}
        />
        <span>{busy ? "Updating…" : active ? "Cooking this" : "I’m cooking this"}</span>
      </label>
      {lowStock.length > 0 && active && (
        <ul className="text-xs text-ember-800">
          {lowStock.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {toast && (
        <p className="max-w-md text-xs text-sage-600" role="status">
          {toast}
        </p>
      )}
    </div>
  );
}
