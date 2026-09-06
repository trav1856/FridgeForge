"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStruggleMode } from "./StruggleModeProvider";
import { RecipeImage } from "./RecipeImage";
import { RecipeIcons } from "./RecipeIcons";
import { FavoriteButton } from "./FavoriteButton";
import { ShareRecipe } from "./ShareRecipe";

type Recipe = {
  id: string;
  title: string;
  description: string | null;
  costTier: string;
  tags: string[];
  servings: number;
  isStruggleMeal: boolean;
  ingredients: { name: string }[];
  imageUrl?: string | null;
  favorited?: boolean;
  ownerUserId?: string | null;
  visibility?: string;
  householdId?: string | null;
};

type Scope = "all" | "mine" | "household" | "favorites";

export function RecipeList() {
  const { struggleMode } = useStruggleMode();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (scope === "favorites") params.set("favorites", "1");
    if (scope === "mine") params.set("scope", "mine");
    if (scope === "household") params.set("scope", "household");
    const res = await fetch(`/api/recipes?${params.toString()}`);
    const data = await res.json();
    setRecipes(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [scope]);

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

  const scopes: { id: Scope; label: string }[] = [
    { id: "all", label: "All" },
    { id: "favorites", label: "Favorites" },
    { id: "mine", label: "My recipes" },
    { id: "household", label: "Household collection" },
  ];

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

      <div className="flex flex-wrap gap-2">
        {scopes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScope(s.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              scope === s.id
                ? "bg-sage-800 text-cream-50"
                : "bg-cream-100 text-sage-800 border border-cream-300"
            }`}
            aria-pressed={scope === s.id}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-sage-600">Loading recipes…</p>
      ) : list.length === 0 ? (
        <p className="card p-6 text-center text-sage-600">No recipes found.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className="card relative flex flex-col overflow-hidden p-0">
              <Link
                href={`/recipes/${r.id}`}
                className="flex flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
                aria-label={`View ${r.title}`}
              >
                <RecipeImage
                  src={r.imageUrl}
                  alt=""
                  className="rounded-none rounded-t-xl"
                />
                <div className="flex flex-1 flex-col p-4 pb-14">
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
                  <RecipeIcons
                    title={r.title}
                    tags={r.tags}
                    ingredients={r.ingredients}
                    description={r.description}
                    className="mb-2"
                  />
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
                </div>
              </Link>
              <div className="absolute bottom-3 right-3 flex items-center gap-1">
                <FavoriteButton
                  recipeId={r.id}
                  initialFavorited={Boolean(r.favorited)}
                />
                <ShareRecipe recipeId={r.id} title={r.title} compact />
                <button
                  type="button"
                  className="btn-ghost text-xs text-red-700"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    remove(r.id);
                  }}
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
