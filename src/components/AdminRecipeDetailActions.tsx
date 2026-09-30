"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { nextVisibility, visibilityLabel } from "@/lib/recipe-visibility";
import {
  ADAPT_NOTE_FIELDS,
  type AdaptNoteKey,
  type AdaptNoteValues,
  type AdminFlagValues,
} from "@/lib/admin-recipe-display";
import {
  AdminAdaptNotesEditor,
  AdminFlagToggles,
  AdminTaxonomyEditor,
  adminDeleteRecipe,
  adminPatchRecipe,
  visibilityClasses,
  type AdminTaxonomyValues,
} from "./AdminRecipeControls";

type Props = {
  id: string;
  title: string;
  visibility: string;
  flags: AdminFlagValues;
  taxonomy: AdminTaxonomyValues;
  /** Kosher / halal / vegan / vegetarian adapt notes (editable by admins). */
  adaptNotes?: AdaptNoteValues;
  /** Show the owner edit link (full recipe editor is owner-only). */
  canOwnerEdit?: boolean;
};

/** Toolbar under the admin detail header: view / edit / visibility / delete. */
export function AdminRecipeDetailToolbar({
  id,
  title,
  visibility: initialVisibility,
  canOwnerEdit,
}: Pick<Props, "id" | "title" | "visibility" | "canOwnerEdit">) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(initialVisibility);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function cycle() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await adminPatchRecipe(id, { visibility: nextVisibility(visibility) });
      if (!res.ok) return setStatus(res.error);
      setVisibility(String(res.data.visibility ?? nextVisibility(visibility)));
      router.refresh();
    } catch {
      setStatus("Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete recipe “${title}”? This cannot be undone.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await adminDeleteRecipe(id);
      if (!res.ok) return setStatus(res.error);
      router.push("/admin/recipes");
      router.refresh();
    } catch {
      setStatus("Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={cycle}
        title={`Click to change to ${visibilityLabel(nextVisibility(visibility))}`}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition hover:brightness-95 disabled:opacity-50 ${visibilityClasses(visibility)}`}
      >
        {visibilityLabel(visibility)}
        <span aria-hidden className="text-[10px] opacity-60">
          ⇄
        </span>
      </button>
      <Link href={`/recipes/${id}`} className="btn-secondary px-3 py-1.5 text-xs">
        View public page
      </Link>
      {canOwnerEdit && (
        <Link href={`/recipes/${id}/edit`} className="btn-secondary px-3 py-1.5 text-xs">
          Edit recipe
        </Link>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={remove}
        className="btn px-3 py-1.5 text-xs text-ember-700 ring-1 ring-inset ring-ember-200 hover:bg-ember-50"
      >
        Delete
      </button>
      {status && (
        <span role="alert" className="text-xs text-ember-700">
          {status}
        </span>
      )}
    </div>
  );
}

/** Sidebar card: flag switches + taxonomy editor. */
export function AdminRecipeDetailControls({
  id,
  flags: initialFlags,
  taxonomy,
  adaptNotes: initialNotes = {},
}: Props) {
  const router = useRouter();
  const [flags, setFlags] = useState<AdminFlagValues>(initialFlags);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<AdaptNoteValues>(initialNotes);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesKey, setNotesKey] = useState(0);

  /** Save changed adapt notes; resolves to an error message or null on success. */
  async function saveNotes(body: AdaptNoteValues): Promise<string | null> {
    setBusy(true);
    try {
      const res = await adminPatchRecipe(id, body);
      if (!res.ok) return res.error;
      const next: AdaptNoteValues = { ...notes };
      for (const { key } of ADAPT_NOTE_FIELDS) {
        const v = res.data[key];
        if (v === null || typeof v === "string") next[key as AdaptNoteKey] = v;
      }
      setNotes(next);
      router.refresh();
      return null;
    } catch {
      return "Update failed";
    } finally {
      setBusy(false);
    }
  }
  const noteCount = ADAPT_NOTE_FIELDS.filter(({ key }) => notes[key]?.trim()).length;

  async function patch(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await adminPatchRecipe(id, body);
      if (!res.ok) return setStatus(res.error);
      const next: AdminFlagValues = { ...flags };
      for (const k of Object.keys(flags) as (keyof AdminFlagValues)[]) {
        if (typeof res.data[k] === "boolean") next[k] = res.data[k] as boolean;
      }
      setFlags(next);
      after?.();
      router.refresh();
    } catch {
      setStatus("Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-sage-600">
          Flags
        </h3>
        <AdminFlagToggles
          values={flags}
          stacked
          disabled={busy}
          onToggle={(key, next) => patch({ [key]: next })}
        />
      </div>
      <div className="border-t border-cream-200 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-sage-600">
            Taxonomy &amp; story
          </h3>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs font-semibold text-sage-700 hover:bg-sage-100"
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
        {editing && (
          <div className="mt-2">
            <AdminTaxonomyEditor
              initial={taxonomy}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSave={(body) => patch(body, () => setEditing(false))}
            />
          </div>
        )}
      </div>
      <div className="border-t border-cream-200 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-sage-600">
            Adapt notes{" "}
            <span className="font-normal normal-case tracking-normal text-sage-400">
              ({noteCount}/{ADAPT_NOTE_FIELDS.length})
            </span>
          </h3>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs font-semibold text-sage-700 hover:bg-sage-100"
            aria-expanded={editingNotes}
            onClick={() => {
              // Re-seed the editor from the latest saved values each time it opens.
              if (!editingNotes) setNotesKey((k) => k + 1);
              setEditingNotes((v) => !v);
            }}
          >
            {editingNotes ? "Close" : "Edit"}
          </button>
        </div>
        {editingNotes ? (
          <div className="mt-2">
            <AdminAdaptNotesEditor
              key={notesKey}
              initial={notes}
              busy={busy}
              onSave={saveNotes}
              onCancel={() => setEditingNotes(false)}
            />
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-sage-500">
            {noteCount
              ? ADAPT_NOTE_FIELDS.filter(({ key }) => notes[key]?.trim())
                  .map(({ label }) => label)
                  .join(" · ")
              : "No adapt notes yet."}
          </p>
        )}
      </div>
      {status && (
        <p role="alert" className="text-xs text-ember-700">
          {status}
        </p>
      )}
    </div>
  );
}
