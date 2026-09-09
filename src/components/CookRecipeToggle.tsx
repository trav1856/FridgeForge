"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Deduction = {
  name: string;
  unit: string;
  deductedQty: number;
  quantityAfter: number;
  lowStock?: boolean;
};

type UndoWithin24h = {
  sessionId: string;
  cookedAt: string;
};

type Props = {
  recipeId: string;
  /** Rendered in the same flex-wrap row as cook / cancel / making-different. */
  shoppingSlot?: ReactNode;
};

function tallyLabel(n: number): string {
  if (n <= 0) return "";
  return n === 1
    ? "You’ve cooked this 1 time"
    : `You’ve cooked this ${n} times`;
}

export function CookRecipeToggle({ recipeId, shoppingSlot }: Props) {
  // Cancel is only available for this page visit after cooking (not restored from server).
  const [canCancel, setCanCancel] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [undoWithin24h, setUndoWithin24h] = useState<UndoWithin24h | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lowStock, setLowStock] = useState<string[]>([]);
  const [cookCount, setCookCount] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/recipes/${recipeId}/cook`);
      const data = await res.json();
      if (res.ok) {
        // Server finalizes any prior active cook on GET — never show Cancel from history.
        setCanCancel(false);
        setSessionId(null);
        setCookCount(
          typeof data.cookCount === "number" && data.cookCount > 0
            ? data.cookCount
            : 0
        );
        setUndoWithin24h(
          data.undoWithin24h &&
            typeof data.undoWithin24h.sessionId === "string" &&
            typeof data.undoWithin24h.cookedAt === "string"
            ? {
                sessionId: data.undoWithin24h.sessionId,
                cookedAt: data.undoWithin24h.cookedAt,
              }
            : null
        );
        setLowStock([]);
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

  // Leaving the page commits the cook (pantry stays deducted; Cancel goes away next visit).
  useEffect(() => {
    function finalize() {
      const id = sessionIdRef.current;
      if (!id) return;
      const url = `/api/recipes/${recipeId}/cook?finalize=1`;
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob(
            [JSON.stringify({ finalize: true, sessionId: id })],
            {
              type: "application/json",
            }
          );
          navigator.sendBeacon(url, blob);
        } else {
          void fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ finalize: true, sessionId: id }),
            keepalive: true,
          });
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("pagehide", finalize);
    return () => {
      window.removeEventListener("pagehide", finalize);
      finalize();
    };
  }, [recipeId]);

  async function startCook() {
    if (busy) return;
    const ok = window.confirm(
      "Deduct ingredients from pantry? You can undo with Cancel cooking while you stay on this page."
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
        setToast(
          typeof data.error === "string"
            ? data.error
            : "Failed to start cook session"
        );
        return;
      }
      setCanCancel(true);
      const sid =
        typeof data.session?.id === "string" ? data.session.id : null;
      setSessionId(sid);
      if (typeof data.cookCount === "number") setCookCount(data.cookCount);
      // Latest cook is now this visit — Cancel covers it; keep 24h undo for after leave.
      if (sid) {
        setUndoWithin24h({
          sessionId: sid,
          cookedAt: new Date().toISOString(),
        });
      }
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
      setToast(lows.length > 0 ? `${summary}. ${lows.join(" · ")}` : summary);
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
      setCanCancel(false);
      setSessionId(null);
      setLowStock([]);
      if (typeof data.cookCount === "number") setCookCount(data.cookCount);
      setUndoWithin24h(
        data.undoWithin24h &&
          typeof data.undoWithin24h.sessionId === "string" &&
          typeof data.undoWithin24h.cookedAt === "string"
          ? {
              sessionId: data.undoWithin24h.sessionId,
              cookedAt: data.undoWithin24h.cookedAt,
            }
          : null
      );
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

  async function makingDifferent() {
    if (busy || !undoWithin24h) return;
    const ok = window.confirm(
      "Restore pantry amounts from your most recent cook of this recipe? (Cook count stays the same.)"
    );
    if (!ok) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/cook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          makingDifferent: true,
          sessionId: undoWithin24h.sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(
          typeof data.error === "string" ? data.error : "Could not restore"
        );
        return;
      }
      if (sessionId && sessionId === undoWithin24h.sessionId) {
        setCanCancel(false);
        setSessionId(null);
        setLowStock([]);
      }
      if (typeof data.cookCount === "number") setCookCount(data.cookCount);
      setUndoWithin24h(
        data.undoWithin24h &&
          typeof data.undoWithin24h.sessionId === "string" &&
          typeof data.undoWithin24h.cookedAt === "string"
          ? {
              sessionId: data.undoWithin24h.sessionId,
              cookedAt: data.undoWithin24h.cookedAt,
            }
          : null
      );
      const n = data.summary?.restoredCount ?? 0;
      setToast(
        data.alreadyUndone
          ? "Already restored."
          : n > 0
            ? `Restored ${n} pantry item${n === 1 ? "" : "s"} — making something different.`
            : "Pantry restored."
      );
    } catch {
      setToast("Could not restore pantry");
    } finally {
      setBusy(false);
    }
  }

  const showMakingDifferent =
    !!undoWithin24h &&
    (!canCancel || undoWithin24h.sessionId !== sessionId);

  const tally = tallyLabel(cookCount);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={loading || busy}
          onClick={() => {
            if (loading || busy) return;
            void startCook();
          }}
        >
          {busy && !canCancel ? "Updating…" : "I’m cooking this"}
        </button>
        {shoppingSlot}
        {canCancel && (
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={loading || busy}
            onClick={() => {
              if (loading || busy) return;
              void cancelCook();
            }}
          >
            Cancel cooking
          </button>
        )}
        {showMakingDifferent && (
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={loading || busy}
            onClick={() => {
              if (loading || busy) return;
              void makingDifferent();
            }}
          >
            I’m making something different
          </button>
        )}
      </div>
      {tally && (
        <p className="text-xs font-medium text-sage-600" data-testid="cook-tally">
          {tally}
        </p>
      )}
      {lowStock.length > 0 && canCancel && (
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
