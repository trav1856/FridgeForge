"use client";

import { useMemo, useState } from "react";
import type { AdminBadgeDTO, AdminCourseBadgeDTO } from "@/lib/badges-admin";

type Props = {
  initialBadges: AdminBadgeDTO[];
  initialCourses: AdminCourseBadgeDTO[];
};

export function AdminBadgesPanel({ initialBadges, initialCourses }: Props) {
  const [rows, setRows] = useState(initialBadges);
  const [courses, setCourses] = useState(initialCourses);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🏅");
  const [createFile, setCreateFile] = useState<File | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    emoji: string;
  } | null>(null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.title.localeCompare(b.title)),
    [rows]
  );

  function upsertRow(badge: AdminBadgeDTO) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === badge.id);
      if (i < 0) return [...prev, badge];
      const next = [...prev];
      next[i] = badge;
      return next;
    });
  }

  async function refreshAll() {
    const res = await fetch("/api/admin/badges");
    const data = await res.json();
    if (res.ok) {
      setRows(data.badges ?? []);
      setCourses(data.courses ?? []);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          emoji,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Create failed");
        return;
      }
      let badge: AdminBadgeDTO = data.badge;
      if (createFile) {
        const fd = new FormData();
        fd.append("file", createFile);
        const up = await fetch(`/api/admin/badges/${badge.id}/image`, {
          method: "POST",
          body: fd,
        });
        const upData = await up.json();
        if (!up.ok) {
          upsertRow(badge);
          setStatus(
            typeof upData.error === "string"
              ? `Created, but image failed: ${upData.error}`
              : "Created, but image upload failed"
          );
          setTitle("");
          setDescription("");
          setEmoji("🏅");
          setCreateFile(null);
          return;
        }
        badge = upData.badge;
      }
      upsertRow(badge);
      setTitle("");
      setDescription("");
      setEmoji("🏅");
      setCreateFile(null);
      setStatus(`Created “${badge.title}” — link it to a How-to course below.`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleExpand(b: AdminBadgeDTO) {
    if (expandedId === b.id) {
      setExpandedId(null);
      setEditDraft(null);
      return;
    }
    setExpandedId(b.id);
    setEditDraft({
      title: b.title,
      description: b.description || "",
      emoji: b.emoji,
    });
  }

  async function onSaveEdit(id: string) {
    if (!editDraft) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/badges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editDraft.title,
          description: editDraft.description || null,
          emoji: editDraft.emoji,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Update failed");
        return;
      }
      upsertRow(data.badge);
      setStatus("Saved");
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function onUploadImage(id: string, file: File | null) {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/badges/${id}/image`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      upsertRow(data.badge);
      setStatus("Photo updated");
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function onClearImage(id: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/badges/${id}/image`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Clear failed");
        return;
      }
      upsertRow(data.badge);
      setStatus("Photo cleared");
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string, titleLabel: string) {
    if (
      !confirm(
        `Delete badge “${titleLabel}”? Existing earn records for this badge will be removed.`
      )
    ) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/badges/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Delete failed");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) {
        setExpandedId(null);
        setEditDraft(null);
      }
      setStatus("Deleted");
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function onSetCourseBadge(courseId: string, badgeId: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/badges/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          badgeId: badgeId === "" ? null : badgeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string" ? data.error : "Course link failed"
        );
        return;
      }
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? data.course : c))
      );
      setStatus("Course badge updated — earn on course complete.");
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-sage-600">
        Badge studio: create and edit badge definitions (name, description,
        emoji, photo). Link each How-to course to the badge it awards when the
        learner finishes every lesson. Users earn badges automatically — they
        cannot create badges.
      </p>
      {status && <p className="text-sm text-ember-700">{status}</p>}

      <form onSubmit={onCreate} className="card space-y-3 p-4">
        <h2 className="font-display text-lg font-bold text-sage-900">
          New badge
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="badge-title">
              Name
            </label>
            <input
              id="badge-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={80}
              disabled={busy}
            />
          </div>
          <div>
            <label className="label" htmlFor="badge-emoji">
              Emoji (optional)
            </label>
            <input
              id="badge-emoji"
              className="input"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={16}
              disabled={busy}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="badge-desc">
            Description (optional)
          </label>
          <textarea
            id="badge-desc"
            className="input min-h-[72px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            disabled={busy}
          />
        </div>
        <div>
          <label className="label" htmlFor="badge-photo">
            Photo (optional, JPEG/PNG/WebP/GIF ≤2MB)
          </label>
          <input
            id="badge-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="block w-full text-sm text-sage-700"
            onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
        </div>
        <button type="submit" className="btn-primary text-sm" disabled={busy}>
          Create badge
        </button>
      </form>

      <div className="card space-y-3 p-4">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Course → badge (earn on complete)
        </h2>
        <p className="text-xs text-sage-600">
          When a signed-in user completes every lesson in a course, they earn
          that course&apos;s badge (idempotent).
        </p>
        <ul className="space-y-2">
          {courses.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-cream-300 bg-cream-50/80 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sage-900">{c.title}</div>
                <div className="text-[11px] text-sage-500">{c.slug}</div>
              </div>
              <select
                className="input max-w-xs text-sm"
                value={c.badgeId ?? ""}
                disabled={busy}
                onChange={(e) => void onSetCourseBadge(c.id, e.target.value)}
              >
                <option value="">No badge</option>
                {sorted.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.emoji} {b.title}
                  </option>
                ))}
              </select>
              {c.badge?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.badge.imageUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : null}
            </li>
          ))}
          {courses.length === 0 ? (
            <li className="text-sm text-sage-600">No How-to courses yet.</li>
          ) : null}
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Badge catalog ({sorted.length})
        </h2>
        <ul className="space-y-2">
          {sorted.map((b) => (
            <li key={b.id} className="card p-3">
              <div className="flex flex-wrap items-center gap-2">
                {b.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-cream-300"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-100 text-xl">
                    {b.emoji}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sage-900">{b.title}</div>
                  <div className="text-[11px] text-sage-500">
                    {b.slug} · {b.awardCount} earned
                    {b.courses.length > 0
                      ? ` · courses: ${b.courses.map((c) => c.title).join(", ")}`
                      : " · not linked to a course"}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => void toggleExpand(b)}
                  disabled={busy}
                >
                  {expandedId === b.id ? "Close" : "Edit"}
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs text-ember-700"
                  onClick={() => void onDelete(b.id, b.title)}
                  disabled={busy || b.courseCount > 0}
                  title={
                    b.courseCount > 0
                      ? "Unlink from How-to course first"
                      : "Delete"
                  }
                >
                  Delete
                </button>
              </div>

              {expandedId === b.id && editDraft && (
                <div className="mt-3 space-y-3 border-t border-cream-300 pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">Name</label>
                      <input
                        className="input"
                        value={editDraft.title}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, title: e.target.value })
                        }
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="label">Emoji</label>
                      <input
                        className="input"
                        value={editDraft.emoji}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, emoji: e.target.value })
                        }
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea
                      className="input min-h-[64px]"
                      value={editDraft.description}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          description: e.target.value,
                        })
                      }
                      disabled={busy}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => void onSaveEdit(b.id)}
                      disabled={busy}
                    >
                      Save
                    </button>
                    <label className="btn-secondary cursor-pointer text-sm">
                      Upload photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        disabled={busy}
                        onChange={(e) =>
                          void onUploadImage(b.id, e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                    {b.imageUrl ? (
                      <button
                        type="button"
                        className="btn-ghost text-sm"
                        onClick={() => void onClearImage(b.id)}
                        disabled={busy}
                      >
                        Clear photo
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
