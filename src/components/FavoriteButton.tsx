"use client";

import { useState, type MouseEvent } from "react";

type Props = {
  recipeId: string;
  initialFavorited?: boolean;
  className?: string;
};

export function FavoriteButton({
  recipeId,
  initialFavorited = false,
  className = "",
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/favorite`, {
        method: "POST",
      });
      if (res.status === 401) {
        window.location.href = "/account";
        return;
      }
      const data = await res.json();
      if (res.ok) setFavorited(Boolean(data.favorited));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      title={favorited ? "Unfavorite" : "Favorite"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-lg transition hover:bg-cream-200 ${className}`}
    >
      {favorited ? "❤️" : "🤍"}
    </button>
  );
}
