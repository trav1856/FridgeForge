"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ShareRow = {
  id: string;
  toUserEmail: string | null;
  toUserId: string | null;
  toHouseholdId: string | null;
  toUser?: { id: string; email: string; name: string | null } | null;
  toHousehold?: { id: string; name: string } | null;
};

type Props = { recipeId: string };

/** List / add / remove Shared recipients (email or household id). */
export function RecipeShareManager({ recipeId }: Props) {
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [visibility, setVisibility] = useState<string>("");
  const [email, setEmail] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/recipes/${recipeId}/share`);
    if (res.status === 401 || res.status === 403) {
      setShares([]);
      return;
    }
    const data = await res.json();
    if (res.ok) {
      setShares(Array.isArray(data.shares) ? data.shares : []);
      setVisibility(data.visibility || "");
    }
  }, [recipeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() && !householdId.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(householdId.trim() ? { householdId: householdId.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Share failed");
        return;
      }
      setEmail("");
      setHouseholdId("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(shareId: string) {
    if (!confirm("Remove this share?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setStatus(typeof data.error === "string" ? data.error : "Remove failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  function label(s: ShareRow): string {
    if (s.toHousehold?.name) return `Household: ${s.toHousehold.name}`;
    if (s.toHouseholdId) return `Household id: ${s.toHouseholdId}`;
    if (s.toUser?.email) return s.toUser.name ? `${s.toUser.name} <${s.toUser.email}>` : s.toUser.email;
    return s.toUserEmail || "Unknown";
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
        Shared with{visibility ? ` · ${visibility}` : ""}
      </p>
      {shares.length === 0 ? (
        <p className="text-xs text-sage-500">Nobody yet — add an email or household id.</p>
      ) : (
        <ul className="space-y-1">
          {shares.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream-50 px-2 py-1"
            >
              <span className="text-xs text-sage-800">{label(s)}</span>
              <button
                type="button"
                className="btn-ghost text-[11px] text-ember-700"
                disabled={busy}
                onClick={() => remove(s.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          type="email"
          className="input text-xs sm:max-w-[14rem]"
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input text-xs sm:max-w-[12rem]"
          placeholder="Household id (optional)"
          value={householdId}
          onChange={(e) => setHouseholdId(e.target.value)}
        />
        <button type="submit" className="btn-secondary text-xs" disabled={busy}>
          Add
        </button>
      </form>
      {status && <p className="text-xs text-ember-700">{status}</p>}
    </div>
  );
}
