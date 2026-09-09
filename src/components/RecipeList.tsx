"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStruggleMode } from "./StruggleModeProvider";
import { RecipeImage } from "./RecipeImage";
import { RecipeIcons } from "./RecipeIcons";
import { FavoriteButton } from "./FavoriteButton";
import { ShareRecipe } from "./ShareRecipe";
import {
  COURSES,
  CUISINES,
  FOOD_CATEGORIES,
  ORIGIN_OPTIONS,
  ORIGIN_REGIONS,
} from "@/lib/recipe-taxonomy";

type Recipe = {
  id: string;
  title: string;
  description: string | null;
  costTier: string;
  tags: string[];
  cuisine?: string | null;
  course?: string | null;
  foodCategories?: string[];
  origins?: string[];
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

function ChipRow({
  label,
  options,
  value,
  onChange,
  searchable,
  clearLabel = "Any",
}: {
  label: string;
  options: { id: string; label: string; depth?: number }[];
  value: string;
  onChange: (v: string) => void;
  searchable?: boolean;
  clearLabel?: string;
}) {
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    if (!searchable || !filter.trim()) return options;
    const n = filter.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(n) || o.id.toLowerCase().includes(n)
    );
  }, [options, filter, searchable]);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-sage-500">
          {label}
        </span>
        {searchable && (
          <input
            className="input max-w-[10rem] py-1 text-xs"
            placeholder={`Search ${label.toLowerCase()}…`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            !value
              ? "bg-sage-800 text-cream-50"
              : "border border-cream-300 bg-cream-100 text-sage-800"
          }`}
          aria-pressed={!value}
        >
          {clearLabel}
        </button>
        {shown.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(value === o.id ? "" : o.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              value === o.id
                ? "bg-sage-800 text-cream-50"
                : "border border-cream-300 bg-cream-100 text-sage-800"
            }`}
            style={o.depth ? { marginLeft: Math.min(o.depth, 2) * 4 } : undefined}
            aria-pressed={value === o.id}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OriginFilterChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const regions = useMemo(() => {
    if (!needle) return ORIGIN_REGIONS;
    return ORIGIN_REGIONS.map((region) => {
      const opts = ORIGIN_OPTIONS.filter(
        (o) =>
          o.regionId === region.id &&
          (o.label.toLowerCase().includes(needle) ||
            o.id.toLowerCase().includes(needle) ||
            region.label.toLowerCase().includes(needle))
      );
      return { region, opts };
    }).filter((r) => r.opts.length > 0);
  }, [needle]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-sage-500">
          Origin
        </span>
        <input
          className="input max-w-[12rem] py-1 text-xs"
          placeholder="Search origins…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          onClick={() => onChange("")}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            !value
              ? "bg-sage-800 text-cream-50"
              : "border border-cream-300 bg-cream-100 text-sage-800"
          }`}
          aria-pressed={!value}
        >
          Any origin
        </button>
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {(needle
          ? regions
          : ORIGIN_REGIONS.map((region) => ({
              region,
              opts: ORIGIN_OPTIONS.filter((o) => o.regionId === region.id),
            }))
        ).map(({ region, opts }) => (
          <div key={region.id} className="space-y-1">
            <p className="text-[11px] font-semibold text-sage-600">
              {region.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {opts.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onChange(value === o.id ? "" : o.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    value === o.id
                      ? "bg-sage-800 text-cream-50"
                      : "border border-cream-300 bg-cream-100 text-sage-800"
                  }`}
                  style={
                    o.depth
                      ? { marginLeft: Math.min(o.depth, 2) * 6 }
                      : undefined
                  }
                  aria-pressed={value === o.id}
                >
                  {o.depth ? `${"· ".repeat(o.depth)}${o.label}` : o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecipeList() {
  const { struggleMode } = useStruggleMode();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const qParam = searchParams.get("q") || "";
  const cuisineParam = searchParams.get("cuisine") || "";
  const courseParam = searchParams.get("course") || "";
  const foodCategoryParam = searchParams.get("foodCategory") || "";
  const originParam =
    searchParams.get("origin") || searchParams.get("ethnicity") || "";
  const scopeParam = (searchParams.get("scope") as Scope) || "all";
  const favoritesParam = searchParams.get("favorites") === "1";

  const scope: Scope = favoritesParam
    ? "favorites"
    : scopeParam === "mine" || scopeParam === "household"
      ? scopeParam
      : "all";

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [qDraft, setQDraft] = useState(qParam);

  useEffect(() => {
    setQDraft(qParam);
  }, [qParam]);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      // Prefer origin over ethnicity
      if (patch.origin !== undefined) next.delete("ethnicity");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (scope === "favorites") params.set("favorites", "1");
    if (scope === "mine") params.set("scope", "mine");
    if (scope === "household") params.set("scope", "household");
    if (qParam.trim()) params.set("q", qParam.trim());
    if (cuisineParam) params.set("cuisine", cuisineParam);
    if (courseParam) params.set("course", courseParam);
    if (foodCategoryParam) params.set("foodCategory", foodCategoryParam);
    if (originParam) params.set("origin", originParam);
    const res = await fetch(`/api/recipes?${params.toString()}`);
    const data = await res.json();
    setRecipes(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [
    scope,
    qParam,
    cuisineParam,
    courseParam,
    foodCategoryParam,
    originParam,
  ]);

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

  const scopes: { id: Scope; label: string }[] = [
    { id: "all", label: "All" },
    { id: "favorites", label: "Favorites" },
    { id: "mine", label: "My recipes" },
    { id: "household", label: "Household collection" },
  ];

  const cuisineOptions = CUISINES.map((c) => ({ id: c, label: c }));
  const courseOptions = COURSES.map((c) => ({
    id: c,
    label: c.charAt(0).toUpperCase() + c.slice(1),
  }));
  const foodOptions = FOOD_CATEGORIES.map((c) => ({
    id: c,
    label: c.charAt(0).toUpperCase() + c.slice(1),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          className="flex max-w-md flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: qDraft.trim() || null });
          }}
        >
          <input
            className="input max-w-xs flex-1"
            placeholder="Search recipes…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
          <button type="submit" className="btn-secondary text-sm">
            Search
          </button>
        </form>
        <Link href="/recipes/new" className="btn-primary">
          Add / import recipe
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {scopes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (s.id === "favorites") {
                setParams({ favorites: "1", scope: null });
              } else if (s.id === "all") {
                setParams({ scope: null, favorites: null });
              } else {
                setParams({ scope: s.id, favorites: null });
              }
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              scope === s.id
                ? "bg-sage-800 text-cream-50"
                : "border border-cream-300 bg-cream-100 text-sage-800"
            }`}
            aria-pressed={scope === s.id}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="card space-y-3 p-3 sm:p-4">
        <ChipRow
          label="Cuisine"
          options={cuisineOptions}
          value={cuisineParam}
          onChange={(v) => setParams({ cuisine: v || null })}
          clearLabel="Any cuisine"
        />
        <ChipRow
          label="Course"
          options={courseOptions}
          value={courseParam}
          onChange={(v) => setParams({ course: v || null })}
          clearLabel="Any course"
        />
        <ChipRow
          label="Food type"
          options={foodOptions}
          value={foodCategoryParam}
          onChange={(v) => setParams({ foodCategory: v || null })}
          clearLabel="Food type"
        />
        <OriginFilterChips
          value={originParam}
          onChange={(v) => setParams({ origin: v || null })}
        />
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
                    {r.cuisine && (
                      <span className="badge bg-sage-200 text-sage-900">
                        {r.cuisine}
                      </span>
                    )}
                    {r.course && (
                      <span className="badge bg-cream-300 text-sage-800">
                        {r.course}
                      </span>
                    )}
                    {r.tags
                      .filter((t) => t !== "struggle")
                      .slice(0, 2)
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
