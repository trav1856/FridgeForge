"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExportJobDTO } from "@/lib/export/jobs";

type Disk = { freeBytes: number; totalBytes: number; dbBytes: number; uploadsBytes: number; estimateFullBytes: number };
type Kind = "full" | "user" | "content";

const KINDS: { id: Kind; title: string; body: string }[] = [
  {
    id: "full",
    title: "Full backup",
    body: "Database dump, every uploaded file, CSV/JSON of every table, manifest, restore guide and restore.sh.",
  },
  {
    id: "user",
    title: "One user's data",
    body: "Profile, recipes, comments, favorites and their household's pantry as CSV/JSON. No database dump. For data requests.",
  },
  {
    id: "content",
    title: "Content only",
    body: "Public recipes, how-tos, badges and shared products with their images. No users, emails, households or pantries. Includes an import script.",
  },
];

function bytes(n: number | null | undefined) {
  if (!n && n !== 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function AdminExportPanel({ users }: { users: { id: string; label: string }[] }) {
  const [jobs, setJobs] = useState<ExportJobDTO[]>([]);
  const [disk, setDisk] = useState<Disk | null>(null);
  const [kind, setKind] = useState<Kind>("full");
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/export", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setJobs(data.jobs);
      setDisk(data.disk);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const building = jobs.some((j) => j.status === "running" || j.status === "queued");
  useEffect(() => {
    if (!building) return;
    const t = setInterval(() => void load(), 1500);
    return () => clearInterval(t);
  }, [building, load]);

  async function build() {
    setErr(null);
    setMsg(null);
    if (encrypt && password.length < 8) return setErr("Use a zip password of at least 8 characters.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, userId: kind === "user" ? userId : null, password: encrypt ? password : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Export failed to start");
      setPassword("");
      setMsg("Building… you can stay on this page.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed to start");
    } finally {
      setBusy(false);
    }
  }

  async function download(j: ExportJobDTO) {
    setErr(null);
    const res = await fetch(`/api/admin/export/${j.id}/link`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(typeof data.error === "string" ? data.error : "Could not create a link");
    const a = document.createElement("a");
    a.href = data.url;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => void load(), 1500);
  }

  const lowDisk = disk && disk.freeBytes < disk.estimateFullBytes + 512 * 1024 * 1024;

  return (
    <div className="space-y-4" data-testid="admin-export">
      <div className="card space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="font-display text-xl font-bold text-sage-900">Export &amp; backup</h2>
          <p className="text-sm text-sage-600">
            Zips are kept on the server outside the website for 1 hour, then deleted. Each download link works once.
            Every export is recorded in the audit log.
          </p>
        </div>

        <div className="grid gap-2 rounded-xl bg-sage-50 p-3 text-sm text-sage-800 sm:grid-cols-4" data-testid="export-disk">
          <p><span className="block text-xs text-sage-500">Free disk</span>{bytes(disk?.freeBytes)} of {bytes(disk?.totalBytes)}</p>
          <p><span className="block text-xs text-sage-500">Database</span>{bytes(disk?.dbBytes)}</p>
          <p><span className="block text-xs text-sage-500">Uploads</span>{bytes(disk?.uploadsBytes)}</p>
          <p><span className="block text-xs text-sage-500">Full backup needs about</span>{bytes(disk?.estimateFullBytes)}</p>
          {lowDisk && <p className="sm:col-span-4 text-red-700">Free space is low. A full backup may not fit.</p>}
        </div>

        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="label mb-1">What to export</legend>
          {KINDS.map((k) => (
            <label
              key={k.id}
              className={`cursor-pointer rounded-xl border p-3 text-sm ${kind === k.id ? "border-ember-500 bg-ember-50" : "border-sage-200 bg-white"}`}
            >
              <input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} className="mr-2" />
              <span className="font-semibold text-sage-900">{k.title}</span>
              <span className="mt-1 block text-xs text-sage-600">{k.body}</span>
            </label>
          ))}
        </fieldset>

        {kind === "user" && (
          <div>
            <label className="label" htmlFor="export-user">User</label>
            <select id="export-user" className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-sage-600">
              Household data (pantry, shopping list, household recipes) is shared and may include other members&apos; entries.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-sage-800">
            <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
            Encrypt the zip with a password (AES-256)
          </label>
          {encrypt && (
            <>
              <input
                className="input max-w-sm"
                type="password"
                autoComplete="new-password"
                placeholder="Zip password (8+ characters)"
                aria-label="Zip password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-sage-600">
                The password is not stored. Open the zip with 7-Zip, Keka or <code>7z x</code>; macOS Archive Utility can&apos;t open AES zips.
                File names inside the zip stay visible.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" type="button" disabled={busy || building} onClick={() => void build()} data-testid="export-build">
            {building ? "Building…" : busy ? "Starting…" : "Build export"}
          </button>
          {msg && <span className="text-sm text-sage-700" role="status">{msg}</span>}
          {err && <span className="text-sm text-red-600" role="alert" data-testid="export-error">{err}</span>}
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="mb-3 font-display text-lg font-bold text-sage-900">Recent exports</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-sage-600">No exports yet.</p>
        ) : (
          <ul className="divide-y divide-sage-100" data-testid="export-jobs">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="export-job" data-id={j.id} data-status={j.status}>
                <div className="min-w-0">
                  <p className="font-semibold text-sage-900">
                    {KINDS.find((k) => k.id === j.kind)?.title ?? j.kind}
                    {j.encrypted ? " · encrypted" : ""}
                  </p>
                  <p className="text-xs text-sage-600">
                    {new Date(j.createdAt).toLocaleString()} · {j.status === "running" ? j.progress || "Building" : j.status}
                    {j.sizeBytes ? ` · ${bytes(j.sizeBytes)}` : ""}
                    {j.status === "done" && j.expiresAt ? ` · deletes ${new Date(j.expiresAt).toLocaleTimeString()}` : ""}
                    {j.downloadCount ? ` · downloaded ${j.downloadCount}×` : ""}
                  </p>
                  {j.manifestSha256 && <p className="truncate font-mono text-[11px] text-sage-500">manifest sha256 {j.manifestSha256}</p>}
                  {j.error && <p className="text-xs text-red-600">{j.error}</p>}
                </div>
                {j.status === "done" && (
                  <button className="btn-secondary" type="button" onClick={() => void download(j)} data-testid="export-download">
                    Download
                  </button>
                )}
                {j.status === "running" && <span className="text-xs text-sage-500" aria-live="polite">⏳ {j.progress}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
