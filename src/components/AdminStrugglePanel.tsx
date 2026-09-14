"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  StruggleKind,
  StruggleLink,
  StruggleResourceDTO,
} from "@/lib/struggle-resources";

type Props = { initial: StruggleResourceDTO[] };

type Draft = {
  kind: StruggleKind;
  title: string;
  slug: string;
  summary: string;
  body: string;
  whenLabel: string;
  sortOrder: string;
  published: boolean;
  linksText: string;
};

function linksToText(links: StruggleLink[]): string {
  return links.map((l) => `${l.label} | ${l.url}`).join("\n");
}

function textToLinks(text: string): StruggleLink[] {
  const out: StruggleLink[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const pipe = trimmed.indexOf("|");
    if (pipe === -1) continue;
    const label = trimmed.slice(0, pipe).trim();
    const url = trimmed.slice(pipe + 1).trim();
    if (label && url) out.push({ label, url });
  }
  return out;
}

function emptyDraft(kind: StruggleKind = "tip"): Draft {
  return {
    kind,
    title: "",
    slug: "",
    summary: "",
    body: "",
    whenLabel: "",
    sortOrder: "",
    published: true,
    linksText: "",
  };
}

function draftFromRow(r: StruggleResourceDTO): Draft {
  return {
    kind: r.kind,
    title: r.title,
    slug: r.slug,
    summary: r.summary,
    body: r.body,
    whenLabel: r.whenLabel ?? "",
    sortOrder: String(r.sortOrder),
    published: r.published,
    linksText: linksToText(r.links),
  };
}

export function AdminStrugglePanel({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | StruggleKind>("all");
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft("tip"));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);

  const visible = useMemo(() => {
    const list =
      filter === "all" ? rows : rows.filter((r) => r.kind === filter);
    return [...list].sort(
      (a, b) =>
        a.kind.localeCompare(b.kind) ||
        a.sortOrder - b.sortOrder ||
        a.title.localeCompare(b.title)
    );
  }, [rows, filter]);

  function upsertRow(resource: StruggleResourceDTO) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === resource.id);
      if (i < 0) return [...prev, resource];
      const next = [...prev];
      next[i] = resource;
      return next;
    });
  }

  async function refresh() {
    const res = await fetch("/api/admin/struggle");
    const data = await res.json();
    if (res.ok) setRows(data.resources ?? []);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/struggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: createDraft.kind,
          title: createDraft.title,
          slug: createDraft.slug || null,
          summary: createDraft.summary,
          body: createDraft.body || "",
          whenLabel: createDraft.whenLabel || null,
          sortOrder: createDraft.sortOrder
            ? Number(createDraft.sortOrder)
            : null,
          published: createDraft.published,
          links: textToLinks(createDraft.linksText),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string" ? data.error : "Create failed"
        );
        return;
      }
      upsertRow(data.resource);
      setCreateDraft(emptyDraft(createDraft.kind));
      setStatus("Created");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onSave(id: string) {
    if (!editDraft) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/struggle/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: editDraft.kind,
          title: editDraft.title,
          slug: editDraft.slug || null,
          summary: editDraft.summary,
          body: editDraft.body || "",
          whenLabel: editDraft.whenLabel || null,
          sortOrder: editDraft.sortOrder ? Number(editDraft.sortOrder) : 0,
          published: editDraft.published,
          links: textToLinks(editDraft.linksText),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      upsertRow(data.resource);
      setStatus("Saved");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this Struggle card?")) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/struggle/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string" ? data.error : "Delete failed"
        );
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) {
        setExpandedId(null);
        setEditDraft(null);
      }
      setStatus("Deleted");
    } finally {
      setBusy(false);
    }
  }

  async function bumpOrder(id: string, delta: number) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/struggle/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sortOrder: Math.max(0, row.sortOrder + delta),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string" ? data.error : "Reorder failed"
        );
        return;
      }
      upsertRow(data.resource);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function DraftFields({
    draft,
    setDraft,
    idPrefix,
  }: {
    draft: Draft;
    setDraft: (d: Draft) => void;
    idPrefix: string;
  }) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-kind`}>
            Kind
          </label>
          <select
            id={`${idPrefix}-kind`}
            className="input"
            value={draft.kind}
            disabled={busy}
            onChange={(e) =>
              setDraft({ ...draft, kind: e.target.value as StruggleKind })
            }
          >
            <option value="tip">Budget tip</option>
            <option value="kids_meal">Kids meal</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-title`}>
            Title
          </label>
          <input
            id={`${idPrefix}-title`}
            className="input"
            value={draft.title}
            required
            maxLength={120}
            disabled={busy}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-slug`}>
            Slug (optional)
          </label>
          <input
            id={`${idPrefix}-slug`}
            className="input"
            value={draft.slug}
            maxLength={64}
            disabled={busy}
            placeholder="auto from title"
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-when`}>
            When label (kids meals)
          </label>
          <input
            id={`${idPrefix}-when`}
            className="input"
            value={draft.whenLabel}
            maxLength={40}
            disabled={busy}
            placeholder="Wed / Mon / app Tue"
            onChange={(e) => setDraft({ ...draft, whenLabel: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-order`}>
            Sort order
          </label>
          <input
            id={`${idPrefix}-order`}
            className="input"
            value={draft.sortOrder}
            disabled={busy}
            inputMode="numeric"
            placeholder="auto"
            onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-sage-800">
            <input
              type="checkbox"
              checked={draft.published}
              disabled={busy}
              onChange={(e) =>
                setDraft({ ...draft, published: e.target.checked })
              }
            />
            Published
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`${idPrefix}-summary`}>
            Card summary
          </label>
          <textarea
            id={`${idPrefix}-summary`}
            className="input min-h-[72px]"
            value={draft.summary}
            required
            maxLength={600}
            disabled={busy}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`${idPrefix}-body`}>
            Detail article (paragraphs; optional [label](url) links)
          </label>
          <textarea
            id={`${idPrefix}-body`}
            className="input min-h-[140px] font-mono text-xs"
            value={draft.body}
            maxLength={20000}
            disabled={busy}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`${idPrefix}-links`}>
            External links (one per line: Label | https://…)
          </label>
          <textarea
            id={`${idPrefix}-links`}
            className="input min-h-[64px] font-mono text-xs"
            value={draft.linksText}
            disabled={busy}
            onChange={(e) => setDraft({ ...draft, linksText: e.target.value })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-sage-600">
        Edit Struggle Mode cards (budget tips + kids-eat-free). End users only
        see these when Struggle Meal mode is on. Cards link to a detail article
        at{" "}
        <code className="rounded bg-cream-200 px-1">/struggle/[slug]</code>.
      </p>
      {status && <p className="text-sm text-ember-700">{status}</p>}

      <form onSubmit={onCreate} className="card space-y-3 p-4">
        <h2 className="font-display text-lg font-bold text-sage-900">
          New card
        </h2>
        <DraftFields
          draft={createDraft}
          setDraft={setCreateDraft}
          idPrefix="create"
        />
        <button type="submit" className="btn-primary text-sm" disabled={busy}>
          Add card
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Catalog ({visible.length})
        </h2>
        <select
          className="input max-w-[10rem] text-sm"
          value={filter}
          onChange={(e) =>
            setFilter(e.target.value as "all" | StruggleKind)
          }
        >
          <option value="all">All kinds</option>
          <option value="tip">Tips</option>
          <option value="kids_meal">Kids meals</option>
        </select>
      </div>

      <ul className="space-y-2">
        {visible.map((r) => (
          <li key={r.id} className="card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-cream-200 text-sage-800">
                {r.kind === "tip" ? "tip" : "kids"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sage-900">{r.title}</div>
                <div className="text-[11px] text-sage-500">
                  {r.slug} · order {r.sortOrder}
                  {r.published ? "" : " · draft"}
                  {r.whenLabel ? ` · ${r.whenLabel}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={busy}
                onClick={() => void bumpOrder(r.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={busy}
                onClick={() => void bumpOrder(r.id, 1)}
              >
                ↓
              </button>
              <Link
                href={`/struggle/${r.slug}`}
                className="btn-ghost text-xs"
                target="_blank"
              >
                Preview
              </Link>
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={busy}
                onClick={() => {
                  if (expandedId === r.id) {
                    setExpandedId(null);
                    setEditDraft(null);
                  } else {
                    setExpandedId(r.id);
                    setEditDraft(draftFromRow(r));
                  }
                }}
              >
                {expandedId === r.id ? "Close" : "Edit"}
              </button>
              <button
                type="button"
                className="btn-ghost text-xs text-ember-700"
                disabled={busy}
                onClick={() => void onDelete(r.id)}
              >
                Delete
              </button>
            </div>
            {expandedId === r.id && editDraft && (
              <div className="mt-3 space-y-3 border-t border-cream-300 pt-3">
                <DraftFields
                  draft={editDraft}
                  setDraft={setEditDraft}
                  idPrefix={`edit-${r.id}`}
                />
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busy}
                  onClick={() => void onSave(r.id)}
                >
                  Save changes
                </button>
              </div>
            )}
          </li>
        ))}
        {visible.length === 0 && (
          <li className="text-sm text-sage-600">No cards yet — add one above.</li>
        )}
      </ul>
    </div>
  );
}
