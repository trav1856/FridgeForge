"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStruggleMode } from "./StruggleModeProvider";

type Recipe = {
  id: string;
  title: string;
  description: string | null;
  costTier: string;
  tags: string[];
  servings: number;
  isStruggleMeal: boolean;
  ingredients: { name: string }[];
};

export function RecipeList() {
  const { struggleMode } = useStruggleMode();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/recipes");
    const data = await res.json();
    setRecipes(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this recipe?")) return;
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    await load();
  }

  let list = recipes;
  if (struggleMode) {
    list = [...recipes].sort((a, b) => {
      const as = (a.isStruggleMeal ? 2 : 0) + (a.costTier === "cheap" ? 1 : 0);
      const bs = (b.isStruggleMeal ? 2 : 0) + (b.costTier === "cheap" ? 1 : 0);
      return bs - as;
    });
  }
  if (q.trim()) {
    const needle = q.toLowerCase();
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.tags.some((t) => t.toLowerCase().includes(needle)) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(needle))
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search recipes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Link href="/recipes/new" className="btn-primary">
          Add / import recipe
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-sage-600">Loading recipes…</p>
      ) : list.length === 0 ? (
        <p className="card p-6 text-center text-sage-600">No recipes found.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className="card flex flex-col p-4">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span
                  className={`badge ${
                    r.costTier === "cheap"
                      ? "bg-sage-100 text-sage-800"
                      : "bg-ember-50 text-ember-800"
                  }`}
                >
                  {r.costTier}
                </span>
                {r.isStruggleMeal && (
                  <span className="badge bg-ember-600 text-white">
                    struggle meal
                  </span>
                )}
                {r.tags
                  .filter((t) => t !== "struggle")
                  .slice(0, 3)
                  .map((t) => (
                    <span key={t} className="badge bg-cream-200 text-sage-700">
                      {t}
                    </span>
                  ))}
              </div>
              <h3 className="font-display text-lg font-bold text-sage-900">
                {r.title}
              </h3>
              {r.description && (
                <p className="mt-1 line-clamp-2 text-sm text-sage-600">
                  {r.description}
                </p>
              )}
              <p className="mt-2 text-xs text-sage-500">
                {r.ingredients.length} ingredients · {r.servings} servings
              </p>
              <div className="mt-auto flex gap-2 pt-3">
                <Link
                  href={`/recipes/${r.id}`}
                  className="btn-secondary text-xs"
                >
                  View
                </Link>
                <button
                  type="button"
                  className="btn-ghost text-xs text-red-700"
                  onClick={() => remove(r.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
