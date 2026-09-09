"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  REVIEW_BODY_MAX,
  reviewShareText,
} from "@/lib/recipe-review";

type Review = {
  id: string;
  stars: number;
  body: string;
  authorName: string;
  createdAt: string;
  userId: string;
};

type Props = {
  recipeId: string;
  recipeTitle: string;
};

function Stars({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-1" role={readOnly ? "img" : "radiogroup"} aria-label="Stars">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value;
        if (readOnly) {
          return (
            <span
              key={n}
              className={active ? "text-ember-600" : "text-cream-300"}
              aria-hidden
            >
              ★
            </span>
          );
        }
        return (
          <button
            key={n}
            type="button"
            className={`text-xl leading-none ${
              active ? "text-ember-600" : "text-cream-300 hover:text-ember-400"
            }`}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => onChange?.(n)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export function RecipeReviews({ recipeId, recipeTitle }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [mine, setMine] = useState<Review | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [averageStars, setAverageStars] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [stars, setStars] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/recipes/${recipeId}/reviews`);
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to load reviews");
      return;
    }
    setReviews(data.reviews || []);
    setMine(data.mine || null);
    setSignedIn(Boolean(data.signedIn));
    setAverageStars(data.averageStars);
    setCount(data.count || 0);
    if (data.mine) {
      setStars(data.mine.stars);
      setBody(data.mine.body || "");
    }
    setLoaded(true);
  }, [recipeId]);

  useEffect(() => {
    load().catch(() => setStatus("Failed to load reviews"));
  }, [load]);

  const url = useMemo(() => {
    if (typeof window === "undefined") return `/recipes/${recipeId}`;
    return `${window.location.origin}/recipes/${recipeId}`;
  }, [recipeId]);

  const shareText = reviewShareText(recipeTitle, stars || mine?.stars || 5);
  const tw = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedIn) {
      window.location.href = "/account";
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, body }),
      });
      if (res.status === 401) {
        window.location.href = "/account";
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Could not save review");
        return;
      }
      setStatus("Saved — thanks for rating!");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-sage-900">
            Ratings & comments
          </h2>
          <p className="text-sm text-sage-600">
            {loaded
              ? count === 0
                ? "No reviews yet — be the first."
                : `${averageStars?.toFixed(1)}★ average · ${count} review${count === 1 ? "" : "s"}`
              : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={tw}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sage-700 hover:bg-cream-200"
            aria-label="Share on X"
            title="X"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.913L1.254 2.25H8.08l4.259 5.699L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
          </a>
          <a
            href={fb}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sage-700 hover:bg-cream-200"
            aria-label="Share on Facebook"
            title="Facebook"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current"><path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.4V9.84c0-2.37 1.41-3.68 3.56-3.68 1.03 0 2.12.18 2.12.18v2.34h-1.2c-1.18 0-1.55.73-1.55 1.48v1.78h2.64l-.42 2.9h-2.22v7.03c4.78-.75 8.44-4.91 8.44-9.93z"/></svg>
          </a>
        </div>
      </div>

      {signedIn ? (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-cream-200 bg-cream-50/80 p-3">
          <p className="text-xs font-semibold text-sage-600">
            {mine ? "Update your rating" : "Your rating"} (any signed-in cook)
          </p>
          <Stars value={stars} onChange={setStars} />
          <div>
            <textarea
              className="input min-h-[72px] w-full text-sm"
              maxLength={REVIEW_BODY_MAX}
              placeholder="Short comment (optional)"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, REVIEW_BODY_MAX))}
            />
            <div className="mt-1 text-right text-[11px] text-sage-500">
              {body.length}/{REVIEW_BODY_MAX}
            </div>
          </div>
          <button type="submit" className="btn-primary text-xs" disabled={busy}>
            {busy ? "Saving…" : mine ? "Update review" : "Post review"}
          </button>
          {status && <p className="text-xs text-sage-700">{status}</p>}
        </form>
      ) : (
        <p className="rounded-xl border border-cream-200 bg-cream-50/80 p-3 text-sm text-sage-700">
          Guests can read reviews.{" "}
          <Link href="/account" className="font-semibold text-ember-700 hover:underline">
            Sign in
          </Link>{" "}
          to rate and comment.
        </p>
      )}

      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="border-t border-cream-200 pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.stars} readOnly />
              <span className="text-sm font-semibold text-sage-800">
                {r.authorName}
              </span>
              <span className="text-[11px] text-sage-500">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
            {r.body ? (
              <p className="mt-1 text-sm text-sage-700">{r.body}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
