"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";

type Item = { name: string; quantity?: number; unit?: string };

type Props = {
  items: Item[];
  recipeId?: string;
  recipeTitle?: string;
  label?: string;
  className?: string;
};

export function AddToShoppingList({
  items,
  recipeId,
  recipeTitle,
  label = "Add missing to shopping list",
  className = "",
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!items.length) return null;

  async function add(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            recipeId,
            recipeTitle,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed");
      } else {
        setStatus(`Added ${data.added ?? items.length} to list`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="btn-secondary text-xs"
      >
        {busy ? "Adding…" : label}
      </button>
      <Link href="/shopping-list" className="text-xs font-medium text-ember-700 hover:underline">
        Open list
      </Link>
      {status && <span className="text-xs text-sage-600">{status}</span>}
    </div>
  );
}
