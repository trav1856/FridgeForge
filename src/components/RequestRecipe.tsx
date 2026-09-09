"use client";

import { FormEvent, useState } from "react";

type Props = {
  recipeId: string;
  /** Compact for cards */
  compact?: boolean;
};

export function RequestRecipe({ recipeId, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("Can I have that recipe?");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/recipe-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId,
          message: message.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        window.location.href = "/account";
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string" ? data.error : "Request failed"
        );
        return;
      }
      setStatus("Request sent — they'll see it under Account.");
      setOpen(false);
    } catch {
      setStatus("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={compact ? "btn-ghost text-xs" : "btn-secondary text-xs"}
        onClick={() => {
          setOpen((v) => !v);
          setStatus(null);
        }}
      >
        {compact ? "Ask for recipe" : "Request recipe"}
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="mt-2 space-y-2 rounded-xl border border-cream-200 bg-cream-50 p-3"
        >
          <label className="block text-xs font-semibold text-sage-600">
            Message
          </label>
          <input
            className="input text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={280}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary text-xs" disabled={busy}>
              {busy ? "Sending…" : "Send request"}
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {status && <p className="mt-1 text-xs text-sage-700">{status}</p>}
    </div>
  );
}
