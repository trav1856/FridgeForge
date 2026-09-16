"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStruggleMode } from "./StruggleModeProvider";
import { RecipeImage } from "./RecipeImage";
import { RecipeIcons } from "./RecipeIcons";
import { FavoriteButton } from "./FavoriteButton";
import { ShareRecipe } from "./ShareRecipe";
import { RecipeCardRating } from "./RecipeCardRating";
import {
  COURSES,
  CUISINES,
  FOOD_CATEGORIES,
  ORIGIN_OPTIONS,
  ORIGIN_REGIONS,
} from "@/lib/recipe-taxonomy";
import {
  cuisineFilterHref,
  foodCategoryFilterHref,
  meatTypeFilterHref,
} from "@/lib/recipe-filter-hrefs";
import { normalizeVisibility } from "@/lib/recipe-visibility";
import { DietaryBadges } from "./DietaryBadges";
import { PersonalDietChrome } from "./PersonalDietChrome";
import type { DietaryUserPrefs } from "@/lib/dietary";

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
  meatType?: string | null;
  servings: number;
  isStruggleMeal: boolean;
  kosherEligible?: boolean;
  halalEligible?: boolean;
  vegetarianEligible?: boolean;
  pescatarianEligible?: boolean;
  veganEligible?: boolean;
  carnivoreEligible?: boolean;
  atkinsEligible?: boolean;
  lowCarbEligible?: boolean;
  lowSugarEligible?: boolean;
  lowSodiumEligible?: boolean;
  kosherAdaptNote?: string | null;
  halalAdaptNote?: string | null;
  veganAdaptNote?: string | null;
  vegetarianAdaptNote?: string | null;
  allergenTags?: string[];
  ingredients: { name: string }[];
  imageUrl?: string | null;
  favorited?: boolean;
  ownerUserId?: string | null;
  visibility?: string;
  householdId?: string | null;
  averageStars?: number | null;
  reviewCount?: number;
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
    return ORIGIN_REGIONS.map((region) => {
      const opts = ORIGIN_OPTIONS.filter(
        (o) =>
          o.regionId === region.id &&
          (!needle ||
            o.label.toLowerCase().includes(needle) ||
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
        {regions.map(({ region, opts }) => (
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
  const meatTypeParam = searchParams.get("meatType") || "";
  const originParam =
    searchParams.get("origin") || searchParams.get("ethnicity") || "";
  const dietaryParam = searchParams.get("dietary") || "";
  const costTierParam = searchParams.get("costTier") || "";
  const struggleParam = searchParams.get("struggle") === "1";
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
  const [dietPrefs, setDietPrefs] = useState<DietaryUserPrefs | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    setQDraft(qParam);
  }, [qParam]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setDietPrefs(data?.user ?? null);
        setCurrentUserId(data?.user?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setDietPrefs(null);
          setCurrentUserId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (meatTypeParam) params.set("meatType", meatTypeParam);
    if (originParam) params.set("origin", originParam);
    if (dietaryParam) params.set("dietary", dietaryParam);
    if (costTierParam) params.set("costTier", costTierParam);
    if (struggleParam) params.set("struggle", "1");
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
    meatTypeParam,
    originParam,
    dietaryParam,
    costTierParam,
    struggleParam,
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
  if (costTierParam === "cheap" || costTierParam === "moderate") {
    list = list.filter((r) => r.costTier === costTierParam);
  }
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

  const cuisineSections: { key: string; label: string; items: Recipe[] }[] =
    (() => {
      if (cuisineParam) {
        return [{ key: cuisineParam, label: cuisineParam, items: list }];
      }
      const order = [...CUISINES, "Uncategorized"];
      const map = new Map<string, Recipe[]>();
      for (const r of list) {
        const key = (r.cuisine || "").trim() || "Uncategorized";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }
      const sections: { key: string; label: string; items: Recipe[] }[] = [];
      for (const c of order) {
        const items = map.get(c);
        if (items?.length) sections.push({ key: c, label: c, items });
      }
      for (const [k, items] of map) {
        if (!order.includes(k as (typeof CUISINES)[number] | "Uncategorized")) {
          sections.push({ key: k, label: k, items });
        }
      }
      return sections;
    })();
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
        <div className="flex flex-wrap gap-2">
          <Link href="/recipes/new" className="btn-primary">
            Add / import recipe
          </Link>
          <Link href="/recipes/import" className="btn-secondary">
            Scan a page
          </Link>
        </div>
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
        <div className="space-y-8">
          {cuisineSections.map((section) => (
            <section key={section.key} aria-label={`${section.label} cuisine`}>
              {!cuisineParam && (
                <h2 className="mb-3 font-display text-xl font-bold text-sage-900">
                  {section.label}
                  <span className="ml-2 text-sm font-medium text-sage-500">
                    ({section.items.length})
                  </span>
                </h2>
              )}
              <ul className="grid gap-3 sm:grid-cols-2">
          {section.items.map((r) => (
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
                <div className="flex flex-1 flex-col p-4 pb-16">
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
                    <DietaryBadges
                      kosherEligible={r.kosherEligible}
                      halalEligible={r.halalEligible}
                      vegetarianEligible={r.vegetarianEligible}
                      pescatarianEligible={r.pescatarianEligible}
                      veganEligible={r.veganEligible}
                      carnivoreEligible={r.carnivoreEligible}
                      atkinsEligible={r.atkinsEligible}
                      lowCarbEligible={r.lowCarbEligible}
                      lowSugarEligible={r.lowSugarEligible}
                      lowSodiumEligible={r.lowSodiumEligible}
                      prefs={dietPrefs}
                    />
                    {r.cuisine ? (
                      <span
                        role="link"
                        tabIndex={0}
                        data-testid="chip-cuisine"
                        className="badge bg-sage-200 text-sage-900 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(cuisineFilterHref(r.cuisine!));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(cuisineFilterHref(r.cuisine!));
                          }
                        }}
                      >
                        {r.cuisine}
                      </span>
                    ) : null}
                    {(r.foodCategories || []).includes("meat") && (
                      <span
                        role="link"
                        tabIndex={0}
                        data-testid="chip-food-meat"
                        className="badge bg-cream-200 text-sage-700 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(foodCategoryFilterHref("meat"));
                        }}
                      >
                        meat
                      </span>
                    )}
                    {r.meatType && (
                      <span
                        role="link"
                        tabIndex={0}
                        data-testid={`chip-meat-${r.meatType}`}
                        className="badge bg-ember-50 text-ember-800 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(meatTypeFilterHref(r.meatType!));
                        }}
                      >
                        {r.meatType}
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
                  <RecipeCardRating
                    averageStars={r.averageStars}
                    reviewCount={r.reviewCount}
                    className="mt-1"
                  />
                  {r.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-sage-600">
                      {r.description}
                    </p>
                  )}
                  <PersonalDietChrome
                    recipe={r}
                    prefs={dietPrefs}
                    compact
                    className="mt-2"
                  />
                  <p className="mt-2 text-xs text-sage-500">
                    {r.ingredients.length} ingredients · {r.servings} servings
                  </p>
                </div>
              </Link>
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1.5">
                {!(r.cuisine || "").trim() && (
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    data-testid="needs-cuisine"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                      Needs cuisine
                    </span>
                    {currentUserId && r.ownerUserId === currentUserId && (
                      <select
                        className="input max-w-[9rem] py-0.5 text-xs"
                        aria-label="Set cuisine"
                        data-testid="card-cuisine-select"
                        defaultValue=""
                        onChange={async (e) => {
                          const next = e.target.value;
                          if (!next) return;
                          const prev = r.cuisine;
                          setRecipes((list) =>
                            list.map((x) =>
                              x.id === r.id ? { ...x, cuisine: next } : x
                            )
                          );
                          const res = await fetch(`/api/recipes/${r.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ cuisine: next }),
                          });
                          if (!res.ok) {
                            setRecipes((list) =>
                              list.map((x) =>
                                x.id === r.id ? { ...x, cuisine: prev } : x
                              )
                            );
                          }
                        }}
                      >
                        <option value="">Set cuisine…</option>
                        {CUISINES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {currentUserId &&
                    r.ownerUserId === currentUserId &&
                    normalizeVisibility(r.visibility) !== "global" && (
                      <button
                        type="button"
                        className="btn-secondary px-2 py-1 text-xs"
                        data-testid="card-make-public"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const res = await fetch(`/api/recipes/${r.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ visibility: "global" }),
                          });
                          if (res.ok) {
                            setRecipes((list) =>
                              list.map((x) =>
                                x.id === r.id
                                  ? { ...x, visibility: "global" }
                                  : x
                              )
                            );
                          }
                        }}
                      >
                        Make public
                      </button>
                    )}
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
              </div>
            </li>
          ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
