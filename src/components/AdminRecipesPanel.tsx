"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  COURSES,
  CUISINES,
  FOOD_CATEGORIES,
  ORIGIN_OPTIONS,
  ORIGIN_REGIONS,
  matchesTaxonomyFilters,
  originLabel,
} from "@/lib/recipe-taxonomy";
import {
  nextVisibility,
  normalizeVisibility,
  visibilityLabel,
} from "@/lib/recipe-visibility";
import { hasRecipePhoto, RECIPE_PLACEHOLDER_PATH } from "@/lib/recipe-image";
import {
  ADMIN_FLAG_GROUPS,
  ADMIN_FLAG_KEYS,
  formatAdminDate,
  ownerDisplay,
  type AdminFlagKey,
} from "@/lib/admin-recipe-display";
import {
  AdminFlagChips,
  AdminFlagToggles,
  AdminTaxonomyEditor,
  adminDeleteRecipe,
  adminPatchRecipe,
  visibilityClasses,
} from "./AdminRecipeControls";

export type AdminRecipeRow = {
  id: string;
  title: string;
  description?: string | null;
  visibility: string;
  costTier: string;
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
  veganAdaptNote?: string | null;
  vegetarianAdaptNote?: string | null;
  reviewCount: number;
  householdId?: string | null;
  cuisine?: string | null;
  course?: string | null;
  foodCategories?: string[];
  origins?: string[];
  originStory?: string | null;
  tags?: string[];
  imageUrl?: string | null;
  ingredients?: { name: string }[];
  owner?: { id: string; name: string | null; email: string } | null;
  /** ISO strings (serialized on the server). */
  createdAt?: string;
  updatedAt?: string;
};

type Props = { initial: AdminRecipeRow[] };

type Panel = { id: string; tab: "flags" | "taxonomy" } | null;

const PATCH_KEYS = [
  "visibility",
  "title",
  ...ADMIN_FLAG_KEYS,
  "kosherAdaptNote",
  "veganAdaptNote",
  "vegetarianAdaptNote",
  "cuisine",
  "course",
  "foodCategories",
  "origins",
  "originStory",
  "tags",
  "updatedAt",
] as const;

function mergePatch(r: AdminRecipeRow, data: Record<string, unknown>): AdminRecipeRow {
  const next: Record<string, unknown> = { ...r };
  for (const k of PATCH_KEYS) {
    if (data[k] !== undefined) {
      next[k] =
        k === "updatedAt" && data[k] instanceof Date
          ? (data[k] as Date).toISOString()
          : data[k];
    }
  }
  return next as AdminRecipeRow;
}

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const ok = hasRecipePhoto(src) && !failed;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ok ? src! : RECIPE_PLACEHOLDER_PATH}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-14 w-14 flex-none rounded-lg bg-cream-100 object-cover ring-1 ring-cream-300"
    />
  );
}

const smallBtn =
  "rounded-lg px-2 py-1 text-xs font-semibold text-sage-700 transition hover:bg-sage-100 disabled:opacity-50";

export function AdminRecipesPanel({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [course, setCourse] = useState("");
  const [foodCategory, setFoodCategory] = useState("");
  const [origin, setOrigin] = useState("");
  const [photoFilter, setPhotoFilter] = useState<"" | "has" | "missing">("");
  const [visFilter, setVisFilter] = useState("");
  const [flagFilter, setFlagFilter] = useState<"" | AdminFlagKey>("");
  const [panel, setPanel] = useState<Panel>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const ownerHit =
        needle &&
        [r.owner?.name, r.owner?.email]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(needle));
      if (
        !matchesTaxonomyFilters(r, {
          q: ownerHit ? null : q,
          cuisine: cuisine || null,
          course: course || null,
          foodCategory: foodCategory || null,
          origin: origin || null,
        })
      ) {
        return false;
      }
      if (visFilter && normalizeVisibility(r.visibility) !== visFilter) return false;
      if (flagFilter && !r[flagFilter]) return false;
      if (photoFilter === "has") return hasRecipePhoto(r.imageUrl);
      if (photoFilter === "missing") return !hasRecipePhoto(r.imageUrl);
      return true;
    });
  }, [rows, q, cuisine, course, foodCategory, origin, photoFilter, visFilter, flagFilter]);

  const anyFilter =
    q || cuisine || course || foodCategory || origin || photoFilter || visFilter || flagFilter;

  function clearFilters() {
    setQ("");
    setCuisine("");
    setCourse("");
    setFoodCategory("");
    setOrigin("");
    setPhotoFilter("");
    setVisFilter("");
    setFlagFilter("");
  }

  async function patch(id: string, body: Record<string, unknown>, closePanel = false) {
    setBusyId(id);
    setStatus(null);
    try {
      const res = await adminPatchRecipe(id, body);
      if (!res.ok) {
        setStatus(res.error);
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? mergePatch(r, res.data) : r)));
      if (closePanel) setPanel(null);
    } catch {
      setStatus("Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete recipe “${title}”? This cannot be undone.`)) return;
    setBusyId(id);
    setStatus(null);
    try {
      const res = await adminDeleteRecipe(id);
      if (!res.ok) {
        setStatus(res.error);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (panel?.id === id) setPanel(null);
    } catch {
      setStatus("Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  function togglePanel(id: string, tab: "flags" | "taxonomy") {
    setPanel((p) => (p && p.id === id && p.tab === tab ? null : { id, tab }));
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input min-w-0 flex-1 sm:max-w-md"
            placeholder="Search title, owner, tags, origins, ingredients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <p className="text-sm text-sage-600">
            <span className="font-semibold text-sage-900">{filtered.length}</span> of{" "}
            {rows.length} recipes
          </p>
          {anyFilter ? (
            <button type="button" className={smallBtn} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <select
            aria-label="Cuisine"
            className="input py-2 text-xs"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
          >
            <option value="">Any cuisine</option>
            {CUISINES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Course"
            className="input py-2 text-xs"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          >
            <option value="">Any course</option>
            {COURSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Food type"
            className="input py-2 text-xs"
            value={foodCategory}
            onChange={(e) => setFoodCategory(e.target.value)}
          >
            <option value="">Any food type</option>
            {FOOD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Origin"
            className="input py-2 text-xs"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          >
            <option value="">Any origin</option>
            {ORIGIN_REGIONS.map((region) => (
              <optgroup key={region.id} label={region.label}>
                {ORIGIN_OPTIONS.filter((o) => o.regionId === region.id).map((o) => (
                  <option key={o.id} value={o.id}>
                    {"—".repeat(o.depth)}
                    {o.depth ? " " : ""}
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            aria-label="Visibility"
            className="input py-2 text-xs"
            value={visFilter}
            onChange={(e) => setVisFilter(e.target.value)}
          >
            <option value="">Any visibility</option>
            <option value="global">Global</option>
            <option value="household">Household</option>
            <option value="shared">Shared</option>
          </select>
          <select
            aria-label="Flag"
            className="input py-2 text-xs"
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value as "" | AdminFlagKey)}
          >
            <option value="">Any flag</option>
            {ADMIN_FLAG_GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.flags.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            aria-label="Photo status"
            className="input py-2 text-xs"
            value={photoFilter}
            onChange={(e) => setPhotoFilter(e.target.value as "" | "has" | "missing")}
          >
            <option value="">Any photo</option>
            <option value="has">Has photo</option>
            <option value="missing">Missing photo</option>
          </select>
        </div>
      </div>

      {status && (
        <p
          role="alert"
          className="rounded-xl border border-ember-200 bg-ember-50 px-3 py-2 text-sm text-ember-800"
        >
          {status}
        </p>
      )}

      <div className="card overflow-hidden">
        {/* Column header (laptop+) */}
        <div className="hidden grid-cols-[minmax(0,1fr)_9rem_6rem_minmax(0,12rem)_8.5rem] gap-3 border-b border-cream-200 bg-cream-50/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-sage-500 lg:grid">
          <span>Recipe</span>
          <span>Owner · updated</span>
          <span>Visibility</span>
          <span>Flags</span>
          <span className="text-right">Actions</span>
        </div>

        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-sage-500">
            No recipes match these filters.
          </p>
        )}

        <ul className="divide-y divide-cream-200">
          {filtered.map((r) => {
            const busy = busyId === r.id;
            const open = panel?.id === r.id ? panel.tab : null;
            const meta = [
              r.cuisine,
              r.course,
              r.costTier,
              `${r.reviewCount} review${r.reviewCount === 1 ? "" : "s"}`,
            ].filter(Boolean);
            return (
              <li key={r.id} className={open ? "bg-cream-50/60" : undefined}>
                <div className="grid grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_9rem_6rem_minmax(0,12rem)_8.5rem] lg:items-center">
                  {/* Recipe */}
                  <div className="flex min-w-0 items-center gap-3">
                    <Thumb src={r.imageUrl} alt={r.title} />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/recipes/${r.id}`}
                        className="line-clamp-2 break-words font-semibold leading-snug text-sage-900 hover:text-ember-700"
                      >
                        {r.title}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-sage-500">
                        {meta.join(" · ")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {!hasRecipePhoto(r.imageUrl) && (
                          <span className="rounded-full bg-ember-100 px-2 py-0.5 text-[10px] font-semibold text-ember-800">
                            Missing photo
                          </span>
                        )}
                        {(r.origins || []).slice(0, 3).map((o) => (
                          <span
                            key={o}
                            className="rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-medium text-sage-700"
                          >
                            {originLabel(o)}
                          </span>
                        ))}
                        {(r.origins || []).length > 3 && (
                          <span className="text-[10px] text-sage-500">
                            +{(r.origins || []).length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Owner + dates */}
                  <div className="min-w-0 text-xs">
                    <p className="truncate">
                      <span className="mr-1 font-semibold text-sage-500 lg:hidden">Owner:</span>
                      <span
                        className={r.owner ? "text-sage-800" : "italic text-sage-500"}
                        title={r.owner?.email || undefined}
                      >
                        {ownerDisplay(r.owner)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-sage-500">
                      Updated {formatAdminDate(r.updatedAt)}
                    </p>
                    <p className="text-[10px] text-sage-400">
                      Created {formatAdminDate(r.createdAt)}
                    </p>
                  </div>

                  {/* Visibility (click cycles, same as before) */}
                  <div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        patch(r.id, { visibility: nextVisibility(r.visibility) })
                      }
                      title={`Click to change to ${visibilityLabel(nextVisibility(r.visibility))} (cycles Global → Household → Shared)`}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset transition hover:brightness-95 disabled:opacity-50 ${visibilityClasses(r.visibility)}`}
                    >
                      {visibilityLabel(r.visibility)}
                      <span aria-hidden className="text-[9px] opacity-60">
                        ⇄
                      </span>
                    </button>
                  </div>

                  {/* Flags */}
                  <div className="min-w-0">
                    <AdminFlagChips values={r} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-0.5 lg:justify-end">
                    <Link href={`/admin/recipes/${r.id}`} className={smallBtn}>
                      Details
                    </Link>
                    <Link href={`/recipes/${r.id}`} className={smallBtn}>
                      View
                    </Link>
                    <button
                      type="button"
                      className={`${smallBtn} ${open === "flags" ? "bg-sage-100" : ""}`}
                      aria-expanded={open === "flags"}
                      disabled={busy}
                      onClick={() => togglePanel(r.id, "flags")}
                    >
                      Flags
                    </button>
                    <button
                      type="button"
                      className={`${smallBtn} ${open === "taxonomy" ? "bg-sage-100" : ""}`}
                      aria-expanded={open === "taxonomy"}
                      disabled={busy}
                      onClick={() => togglePanel(r.id, "taxonomy")}
                    >
                      {open === "taxonomy" ? "Cancel" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className={`${smallBtn} text-ember-700 hover:bg-ember-50`}
                      disabled={busy}
                      onClick={() => remove(r.id, r.title)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {open === "flags" && (
                  <div className="border-t border-cream-200 px-4 py-3">
                    <AdminFlagToggles
                      values={r}
                      disabled={busy}
                      onToggle={(key, next) => patch(r.id, { [key]: next })}
                    />
                  </div>
                )}
                {open === "taxonomy" && (
                  <div className="border-t border-cream-200 px-4 py-3">
                    <AdminTaxonomyEditor
                      initial={r}
                      busy={busy}
                      onCancel={() => setPanel(null)}
                      onSave={(body) => patch(r.id, body, true)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
