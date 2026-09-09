"use client";

import Link from "next/link";
import { useState } from "react";

type RecipeRow = {
  id: string;
  title: string;
  visibility: string;
  costTier: string;
  isStruggleMeal: boolean;
  reviewCount: number;
  householdId?: string | null;
};

type Props = { initial: RecipeRow[] };

export function AdminRecipesPanel({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/recipes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Update failed");
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                visibility: data.visibility ?? r.visibility,
                title: data.title ?? r.title,
                isStruggleMeal: data.isStruggleMeal ?? r.isStruggleMeal,
              }
            : r
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete recipe “${title}”? This cannot be undone.`)) return;
    setBusyId(id);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/recipes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Delete failed");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  function cycleVisibility(v: string): "private" | "household" | "public" {
    if (v === "private") return "household";
    if (v === "household") return "public";
    return "private";
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-sage-600">
        {rows.length} recipes — toggle shared visibility, struggle flag, or delete.
      </p>
      {status && <p className="text-sm text-ember-700">{status}</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/recipes/${r.id}`}
                className="font-semibold text-sage-900 hover:text-ember-700"
              >
                {r.title}
              </Link>
              <div className="mt-0.5 text-[11px] text-sage-500">
                {r.costTier}
                {r.isStruggleMeal ? " · struggle" : ""}
                {r.householdId ? "" : " · shared catalog"}
                {" · "}
                {r.reviewCount} reviews
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busyId === r.id}
              onClick={() =>
                patch(r.id, { visibility: cycleVisibility(r.visibility) })
              }
              title="Cycle private → household → public"
            >
              vis: {r.visibility}
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busyId === r.id}
              onClick={() =>
                patch(r.id, { isStruggleMeal: !r.isStruggleMeal })
              }
            >
              {r.isStruggleMeal ? "Unflag struggle" : "Flag struggle"}
            </button>
            <button
              type="button"
              className="btn-ghost text-xs text-ember-700"
              disabled={busyId === r.id}
              onClick={() => remove(r.id, r.title)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
