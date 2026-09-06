"use client";

import { useMemo, useState, type FormEvent, type MouseEvent } from "react";

type Props = {
  recipeId: string;
  title: string;
  /** Compact for cards */
  compact?: boolean;
};

export function ShareRecipe({ recipeId, title, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const url = useMemo(() => {
    if (typeof window === "undefined") return `/recipes/${recipeId}`;
    return `${window.location.origin}/recipes/${recipeId}`;
  }, [recipeId]);

  const text = `Check out ${title} on FridgeForge`;

  async function webShare(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // fall through
      }
    }
    setOpen(true);
  }

  async function copyLink(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      setStatus("Copy failed");
    }
  }

  async function sendToFriend(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!email.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 401) {
        window.location.href = "/account";
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Share failed");
      } else {
        setStatus("Invite sent — friend can accept from Account (scaffold)");
        setEmail("");
      }
    } finally {
      setBusy(false);
    }
  }

  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const tw = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={webShare}
        className={
          compact
            ? "inline-flex h-9 w-9 items-center justify-center rounded-full text-sm hover:bg-cream-200"
            : "btn-secondary text-xs"
        }
        aria-label="Share recipe"
        title="Share"
      >
        {compact ? "↗" : "Share"}
      </button>
      {(open || !compact) && (
        <div
          className={
            compact
              ? "absolute right-0 z-20 mt-1 w-64 rounded-xl border border-cream-300 bg-white p-3 shadow-lg"
              : "mt-3 space-y-2 rounded-xl border border-cream-200 bg-cream-50 p-3"
          }
        >
          {compact && (
            <button
              type="button"
              className="mb-2 text-xs text-sage-500"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost text-xs" onClick={copyLink}>
              Copy link
            </button>
            <a
              href={fb}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              Facebook
            </a>
            <a
              href={tw}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              X / Twitter
            </a>
          </div>
          <form onSubmit={sendToFriend} className="space-y-2 border-t border-cream-200 pt-2">
            <label className="block text-xs font-semibold text-sage-600">
              Send to friend (email)
            </label>
            <input
              type="email"
              className="input text-sm"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary text-xs" disabled={busy}>
              {busy ? "Sending…" : "Send invite"}
            </button>
            <p className="text-[10px] text-sage-500">
              Contacts sync is on the roadmap — email invite clones into their library when accepted.
            </p>
          </form>
          {status && <p className="text-xs text-sage-700">{status}</p>}
        </div>
      )}
    </div>
  );
}
