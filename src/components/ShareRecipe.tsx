"use client";

import { useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { RecipeShareManager } from "./RecipeShareManager";

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
        // fall through to panel
      }
    }
    setOpen((v) => !v);
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
      {open && (
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sage-700 hover:bg-cream-200"
              aria-label="Share on Facebook"
              title="Facebook"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current"><path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.4V9.84c0-2.37 1.41-3.68 3.56-3.68 1.03 0 2.12.18 2.12.18v2.34h-1.2c-1.18 0-1.55.73-1.55 1.48v1.78h2.64l-.42 2.9h-2.22v7.03c4.78-.75 8.44-4.91 8.44-9.93z"/></svg>
            </a>
            <a
              href={tw}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sage-700 hover:bg-cream-200"
              aria-label="Share on X"
              title="X"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.913L1.254 2.25H8.08l4.259 5.699L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
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
          <div className="border-t border-cream-200 pt-2">
            <RecipeShareManager recipeId={recipeId} />
          </div>
        </div>
      )}
    </div>
  );
}
