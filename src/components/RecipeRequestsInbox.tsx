"use client";

import { useCallback, useEffect, useState } from "react";

type Incoming = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  recipe: { id: string; title: string };
  fromUser: { id: string; email: string; name: string | null };
};

export function RecipeRequestsInbox() {
  const [items, setItems] = useState<Incoming[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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
    setBusyId(id);
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
    } catch {
      setError("Network error");
    } finally {
      setBusyId(null);
    }
  }

  const pending = items.filter((i) => i.status === "pending");

  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-display text-xl font-bold text-sage-900">
        Recipe requests
      </h2>
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
      ) : pending.length === 0 ? (
        <p className="text-sm text-sage-600">No pending requests.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-cream-300 bg-cream-50/80 px-3 py-3"
            >
              <div className="font-medium text-sage-900">{r.recipe.title}</div>
              <div className="mt-0.5 text-xs text-sage-600">
                From {r.fromUser.name || r.fromUser.email}
                {r.message ? ` — “${r.message}”` : ""}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary text-xs"
                  disabled={busyId === r.id}
                  onClick={() => void act(r.id, "accept")}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={busyId === r.id}
                  onClick={() => void act(r.id, "decline")}
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
