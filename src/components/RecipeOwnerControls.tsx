"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  normalizeVisibility,
  visibilityLabel,
  type RecipeVisibility,
} from "@/lib/recipe-visibility";

type Props = {
  recipeId: string;
  visibility?: string | null;
};

const OPTIONS: { value: RecipeVisibility; label: string }[] = [
  { value: "global", label: "Public (everyone)" },
  { value: "household", label: "Household only" },
  { value: "shared", label: "Shared with people you pick" },
];

/** Owner-only Edit + visibility controls on recipe detail. */
export function RecipeOwnerControls({ recipeId, visibility }: Props) {
  const router = useRouter();
  const current = normalizeVisibility(visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localVis, setLocalVis] = useState<RecipeVisibility>(current);

  async function setVisibility(next: RecipeVisibility) {
    if (next === localVis || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not update visibility"
        );
        return;
      }
      setLocalVis(normalizeVisibility(data.visibility ?? next));
      router.refresh();
    } catch {
      setError("Could not update visibility");
    } finally {
      setBusy(false);
    }
  }

  const isPublic = localVis === "global";

  return (
    <div
      className="card space-y-3 p-4"
      data-testid="recipe-owner-controls"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/recipes/${recipeId}/edit`}
          className="btn-primary"
          data-testid="edit-recipe"
        >
          Edit recipe
        </Link>
        {!isPublic && (
          <button
            type="button"
            className="btn-secondary"
            data-testid="make-public"
            disabled={busy}
            onClick={() => void setVisibility("global")}
          >
            {busy ? "Updating…" : "Make public"}
          </button>
        )}
        {isPublic && (
          <span
            className="badge bg-sage-100 text-sage-800"
            data-testid="visibility-public-badge"
          >
            Public
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
          Visibility · {visibilityLabel(localVis)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {OPTIONS.map((opt) => {
            const active = localVis === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={busy || active}
                data-testid={`visibility-${opt.value}`}
                onClick={() => void setVisibility(opt.value)}
                className={
                  active
                    ? "rounded-full bg-ember-600 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-sage-200 bg-cream-50 px-3 py-1 text-xs font-medium text-sage-800 hover:border-ember-300"
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-sage-500">
          Public recipes appear in the shared catalog. Household keeps it in your
          kitchen. Shared is for people you explicitly invite.
        </p>
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}
