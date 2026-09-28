"use client";

import { useState } from "react";
import {
  COURSES,
  CUISINES,
  FOOD_CATEGORIES,
  ORIGIN_OPTIONS,
  ORIGIN_REGIONS,
} from "@/lib/recipe-taxonomy";
import { normalizeVisibility, visibilityLabel } from "@/lib/recipe-visibility";
import {
  ADMIN_FLAG_GROUPS,
  activeAdminFlags,
  type AdminFlagGroup,
  type AdminFlagKey,
  type AdminFlagValues,
} from "@/lib/admin-recipe-display";

/* ------------------------------------------------------------------ */
/* API helpers (same endpoints the admin panel always used)            */
/* ------------------------------------------------------------------ */

export type AdminApiResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function errorText(data: unknown, fallback: string): string {
  const e = (data as { error?: unknown })?.error;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const fe = e as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const msgs = [
      ...(fe.formErrors || []),
      ...Object.entries(fe.fieldErrors || {}).map(
        ([k, v]) => `${k}: ${(v || []).join(", ")}`
      ),
    ];
    if (msgs.length) return msgs.join("; ");
  }
  return fallback;
}

export async function adminPatchRecipe(
  id: string,
  body: Record<string, unknown>
): Promise<AdminApiResult> {
  const res = await fetch("/api/admin/recipes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: errorText(data, "Update failed") };
  return { ok: true, data };
}

export async function adminDeleteRecipe(id: string): Promise<AdminApiResult> {
  const res = await fetch("/api/admin/recipes", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: errorText(data, "Delete failed") };
  return { ok: true, data };
}

/* ------------------------------------------------------------------ */
/* Visual bits                                                         */
/* ------------------------------------------------------------------ */

const VISIBILITY_CLASSES: Record<string, string> = {
  global: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  shared: "bg-sky-50 text-sky-800 ring-sky-200",
  household: "bg-cream-100 text-sage-700 ring-cream-300",
};

export function visibilityClasses(v: string | null | undefined): string {
  return VISIBILITY_CLASSES[normalizeVisibility(v)] || VISIBILITY_CLASSES.household;
}

export function VisibilityBadge({ value }: { value: string | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${visibilityClasses(value)}`}
    >
      {visibilityLabel(value)}
    </span>
  );
}

const FLAG_CHIP: Record<AdminFlagGroup["id"], string> = {
  program: "bg-ember-100 text-ember-800",
  religious: "bg-indigo-50 text-indigo-800",
  diet: "bg-sage-100 text-sage-800",
};

/** Read-only chips for the flags that are ON. */
export function AdminFlagChips({
  values,
  emptyText = "No flags",
}: {
  values: AdminFlagValues;
  emptyText?: string;
}) {
  const active = activeAdminFlags(values);
  if (!active.length) {
    return <span className="text-[11px] text-sage-400">{emptyText}</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {active.map((f) => (
        <span
          key={f.key}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${FLAG_CHIP[f.group]}`}
        >
          {f.label}
        </span>
      ))}
    </span>
  );
}

/** Grouped on/off switches for every admin flag. */
export function AdminFlagToggles({
  values,
  disabled,
  onToggle,
  stacked,
}: {
  values: AdminFlagValues;
  disabled?: boolean;
  onToggle: (key: AdminFlagKey, next: boolean) => void;
  /** Labels above chips (for narrow sidebars). */
  stacked?: boolean;
}) {
  return (
    <div className={`grid gap-x-3 gap-y-2 ${stacked ? "" : "sm:grid-cols-[auto_1fr]"}`}>
      {ADMIN_FLAG_GROUPS.map((g) => (
        <div key={g.id} className="contents">
          <div className={`${stacked ? "" : "pt-1"} text-[11px] font-semibold uppercase tracking-wide text-sage-500`}>
            {g.label}
          </div>
          <div>
            <div className="flex flex-wrap gap-1.5">
              {g.flags.map((f) => {
                const on = Boolean(values[f.key]);
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={disabled}
                    onClick={() => onToggle(f.key, !on)}
                    title={on ? `Unflag ${f.label}` : `Flag ${f.label}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                      on
                        ? "border-sage-700 bg-sage-800 text-cream-50 hover:bg-sage-700"
                        : "border-cream-300 bg-white text-sage-700 hover:bg-cream-100"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-300" : "bg-sage-300"}`}
                    />
                    {f.label}
                  </button>
                );
              })}
            </div>
            {g.hint && <p className="mt-1 text-[10px] text-sage-400">{g.hint}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Taxonomy editor (cuisine, course, food categories, origins, story)  */
/* ------------------------------------------------------------------ */

export type AdminTaxonomyValues = {
  cuisine?: string | null;
  course?: string | null;
  foodCategories?: string[];
  origins?: string[];
  originStory?: string | null;
};

function toggleIn(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function AdminTaxonomyEditor({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: AdminTaxonomyValues;
  busy?: boolean;
  onSave: (body: {
    cuisine: string | null;
    course: string | null;
    foodCategories: string[];
    origins: string[];
    originStory: string | null;
  }) => void;
  onCancel?: () => void;
}) {
  const [cuisine, setCuisine] = useState(initial.cuisine || "");
  const [course, setCourse] = useState(initial.course || "");
  const [foodCats, setFoodCats] = useState<string[]>(initial.foodCategories || []);
  const [origins, setOrigins] = useState<string[]>(initial.origins || []);
  const [story, setStory] = useState(initial.originStory || "");

  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
            Cuisine
          </span>
          <select
            className="input text-sm"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
          >
            <option value="">—</option>
            {CUISINES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
            Course
          </span>
          <select
            className="input text-sm"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
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
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
          Food categories
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {FOOD_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={foodCats.includes(c)}
              className={`rounded-full px-2 py-0.5 text-xs ${
                foodCats.includes(c)
                  ? "bg-sage-800 text-cream-50"
                  : "border border-cream-300 bg-cream-50 text-sage-700"
              }`}
              onClick={() => setFoodCats(toggleIn(foodCats, c))}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
          Origins (by region)
        </span>
        <div className="mt-1 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-cream-200 bg-cream-50/60 p-2">
          {ORIGIN_REGIONS.map((region) => (
            <div key={region.id}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sage-500">
                {region.label}
              </p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {ORIGIN_OPTIONS.filter((o) => o.regionId === region.id).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={origins.includes(o.id)}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      origins.includes(o.id)
                        ? "bg-sage-800 text-cream-50"
                        : "border border-cream-300 bg-white text-sage-700"
                    }`}
                    onClick={() => setOrigins(toggleIn(origins, o.id))}
                  >
                    {o.depth ? "· ".repeat(o.depth) : ""}
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
          Story behind this food
        </span>
        <textarea
          className="input mt-1 min-h-[88px] text-sm"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="Short cultural/history blurb…"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy}
          onClick={() =>
            onSave({
              cuisine: cuisine || null,
              course: course || null,
              foodCategories: foodCats,
              origins,
              originStory: story.trim() || null,
            })
          }
        >
          Save taxonomy
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost text-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
