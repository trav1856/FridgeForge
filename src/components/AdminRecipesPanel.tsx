"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  COURSES,
  CUISINES,
  FOOD_CATEGORIES,
  ORIGIN_OPTIONS,
  matchesTaxonomyFilters,
} from "@/lib/recipe-taxonomy";

type RecipeRow = {
  id: string;
  title: string;
  visibility: string;
  costTier: string;
  isStruggleMeal: boolean;
  reviewCount: number;
  householdId?: string | null;
  cuisine?: string | null;
  course?: string | null;
  foodCategories?: string[];
  origins?: string[];
  tags?: string[];
};

type Props = { initial: RecipeRow[] };

export function AdminRecipesPanel({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [course, setCourse] = useState("");
  const [foodCategory, setFoodCategory] = useState("");
  const [origin, setOrigin] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCuisine, setEditCuisine] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editFoodCats, setEditFoodCats] = useState<string[]>([]);
  const [editOrigins, setEditOrigins] = useState<string[]>([]);

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        matchesTaxonomyFilters(r, {
          q,
          cuisine: cuisine || null,
          course: course || null,
          foodCategory: foodCategory || null,
          origin: origin || null,
        })
      ),
    [rows, q, cuisine, course, foodCategory, origin]
  );

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
                cuisine: data.cuisine ?? r.cuisine,
                course: data.course ?? r.course,
                foodCategories: data.foodCategories ?? r.foodCategories,
                origins: data.origins ?? r.origins,
                tags: data.tags ?? r.tags,
              }
            : r
        )
      );
      setEditingId(null);
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

  function startEdit(r: RecipeRow) {
    setEditingId(r.id);
    setEditCuisine(r.cuisine || "");
    setEditCourse(r.course || "");
    setEditFoodCats(r.foodCategories || []);
    setEditOrigins(r.origins || []);
  }

  function toggleIn(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-sage-600">
        {filtered.length} of {rows.length} recipes — search, filter, edit taxonomy,
        visibility, struggle flag, or delete.
      </p>

      <div className="card space-y-2 p-3">
        <input
          className="input max-w-md"
          placeholder="Search title, tags, origins…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <select
            className="input max-w-[10rem] text-sm"
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
            className="input max-w-[10rem] text-sm"
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
            className="input max-w-[10rem] text-sm"
            value={foodCategory}
            onChange={(e) => setFoodCategory(e.target.value)}
          >
            <option value="">Any food</option>
            {FOOD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="input max-w-[14rem] text-sm"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          >
            <option value="">Any origin</option>
            {ORIGIN_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {"—".repeat(o.depth)}
                {o.depth ? " " : ""}
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status && <p className="text-sm text-ember-700">{status}</p>}
      <ul className="space-y-2">
        {filtered.map((r) => (
          <li key={r.id} className="card space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
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
                  {r.cuisine ? ` · ${r.cuisine}` : ""}
                  {r.course ? ` · ${r.course}` : ""}
                  {(r.foodCategories || []).length
                    ? ` · ${(r.foodCategories || []).join(", ")}`
                    : ""}
                  {(r.origins || []).length
                    ? ` · origins: ${(r.origins || []).join(", ")}`
                    : ""}
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
                className="btn-ghost text-xs"
                disabled={busyId === r.id}
                onClick={() =>
                  editingId === r.id ? setEditingId(null) : startEdit(r)
                }
              >
                {editingId === r.id ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                className="btn-ghost text-xs text-ember-700"
                disabled={busyId === r.id}
                onClick={() => remove(r.id, r.title)}
              >
                Delete
              </button>
            </div>

            {editingId === r.id && (
              <div className="space-y-2 border-t border-cream-200 pt-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-sage-500">Cuisine</span>
                    <select
                      className="input text-sm"
                      value={editCuisine}
                      onChange={(e) => setEditCuisine(e.target.value)}
                    >
                      <option value="">—</option>
                      {CUISINES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-sage-500">Course</span>
                    <select
                      className="input text-sm"
                      value={editCourse}
                      onChange={(e) => setEditCourse(e.target.value)}
                    >
                      <option value="">—</option>
                      {COURSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div>
                  <span className="text-[11px] text-sage-500">Food categories</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {FOOD_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          editFoodCats.includes(c)
                            ? "bg-sage-800 text-cream-50"
                            : "border border-cream-300 bg-cream-50"
                        }`}
                        onClick={() =>
                          setEditFoodCats(toggleIn(editFoodCats, c))
                        }
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-sage-500">
                    Origins / ethnicity
                  </span>
                  <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                    {ORIGIN_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          editOrigins.includes(o.id)
                            ? "bg-sage-800 text-cream-50"
                            : "border border-cream-300 bg-cream-50"
                        }`}
                        onClick={() =>
                          setEditOrigins(toggleIn(editOrigins, o.id))
                        }
                      >
                        {o.depth ? "· ".repeat(o.depth) : ""}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busyId === r.id}
                  onClick={() =>
                    patch(r.id, {
                      cuisine: editCuisine || null,
                      course: editCourse || null,
                      foodCategories: editFoodCats,
                      origins: editOrigins,
                    })
                  }
                >
                  Save taxonomy
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
