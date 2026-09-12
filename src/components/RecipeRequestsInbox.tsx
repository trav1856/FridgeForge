"use client";

import { useCallback, useEffect, useState } from "react";
import {
  groupPendingByRecipe,
  notifyRecipeRequestsChanged,
  type IncomingRequestRow,
} from "@/lib/recipe-request";

export function RecipeRequestsInbox() {
  const [items, setItems] = useState<IncomingRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** recipeIds whose "Choose who gets this" list is expanded */
  const [choosing, setChoosing] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recipe-requests?box=incoming");
      if (res.status === 401) {
        setItems([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load");
        return;
      }
      setItems(data.requests ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "accept" | "decline") {
    setBusyKey(id);
    setNote(null);
    setError(null);
    try {
      const res = await fetch(`/api/recipe-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Action failed");
        return;
      }
      setNote(
        action === "accept"
          ? data.recipeId
            ? `Accepted — copied into their household (recipe ${data.recipeId}).`
            : "Accepted."
          : "Declined."
      );
      await load();
      notifyRecipeRequestsChanged();
    } catch {
      setError("Network error");
    } finally {
      setBusyKey(null);
    }
  }

  async function acceptAllForRecipe(recipeId: string, title: string, count: number) {
    const ok = window.confirm(
      `Accept all ${count} pending request${count === 1 ? "" : "s"} for “${title}”?`
    );
    if (!ok) return;
    setBusyKey(`all:${recipeId}`);
    setNote(null);
    setError(null);
    try {
      const res = await fetch("/api/recipe-requests/bulk-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Bulk accept failed"
        );
        return;
      }
      const n = typeof data.approved === "number" ? data.approved : count;
      setNote(
        n === 0
          ? "No pending requests left to accept."
          : `Accepted ${n} request${n === 1 ? "" : "s"} for “${title}”.`
      );
      await load();
      notifyRecipeRequestsChanged();
    } catch {
      setError("Network error");
    } finally {
      setBusyKey(null);
    }
  }

  const groups = groupPendingByRecipe(items);
  const pendingTotal = groups.reduce((n, g) => n + g.requests.length, 0);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-sage-900">
          Recipe requests
        </h2>
        {pendingTotal > 0 && (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
            {pendingTotal > 99 ? "99+" : pendingTotal}
          </span>
        )}
      </div>
      <p className="text-sm text-sage-600">
        When someone asks &quot;Can I have that recipe?&quot; it shows up here.
        Accept copies the recipe into their household.
      </p>
      {error && (
        <div className="rounded-xl border border-ember-200 bg-ember-50 px-3 py-2 text-sm text-ember-800">
          {error}
        </div>
      )}
      {note && (
        <div className="rounded-xl border border-sage-200 bg-sage-50 px-3 py-2 text-sm text-sage-800">
          {note}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-sage-600">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-sage-600">No pending requests.</p>
      ) : (
        <ul className="space-y-4">
          {groups.map((g) => {
            const multi = g.requests.length > 1;
            const showWho = multi
              ? Boolean(choosing[g.recipeId])
              : true;
            return (
              <li
                key={g.recipeId}
                className="rounded-xl border border-cream-300 bg-cream-50/80 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sage-900">{g.title}</div>
                    <div className="mt-0.5 text-xs text-sage-600">
                      {g.requests.length} pending request
                      {g.requests.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {multi && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={busyKey === `all:${g.recipeId}`}
                        onClick={() =>
                          void acceptAllForRecipe(
                            g.recipeId,
                            g.title,
                            g.requests.length
                          )
                        }
                      >
                        Approve all
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() =>
                          setChoosing((prev) => ({
                            ...prev,
                            [g.recipeId]: !showWho,
                          }))
                        }
                      >
                        Choose who gets this
                      </button>
                    </div>
                  )}
                </div>
                {showWho && (
                  <div className="mt-3 space-y-2 border-t border-cream-300 pt-3">
                    {multi && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
                        Choose who gets this
                      </p>
                    )}
                    <ul className="space-y-2">
                    {g.requests.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0 text-xs text-sage-700">
                          <span className="font-medium text-sage-900">
                            {r.fromUser.name || r.fromUser.email}
                          </span>
                          {r.message ? (
                            <span className="text-sage-600">
                              {" "}
                              — “{r.message}”
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-primary text-xs"
                            disabled={busyKey === r.id}
                            onClick={() => void act(r.id, "accept")}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            disabled={busyKey === r.id}
                            onClick={() => void act(r.id, "decline")}
                          >
                            Decline
                          </button>
                        </div>
                      </li>
                    ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
