"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export type AdminUserActionsProps = {
  user: {
    id: string;
    email: string;
    role: string;
    plan: string;
    disabled: boolean;
    disabledReason: string | null;
    disabledSummary: string | null;
  };
  isSelf: boolean;
  isLastAdmin: boolean;
  activeSessions: number;
  deletePreview: string[];
};

function errText(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error: unknown }).error;
    if (typeof e === "string") return e;
    if (e && typeof e === "object") {
      const fe = (e as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      const first = fe && Object.values(fe).flat()[0];
      if (first) return first;
    }
  }
  return fallback;
}

const rowCls = "border-t border-cream-200 py-3.5 first:border-t-0 first:pt-0";
const smBtn = "btn-secondary px-3 py-1.5 text-[13px]";

export function AdminUserActions({ user, isSelf, isLastAdmin, activeSessions, deletePreview }: AdminUserActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [resetLink, setResetLink] = useState<{ url: string; expires: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [roleConfirm, setRoleConfirm] = useState(false);
  const [plan, setPlan] = useState(user.plan);
  const [exported, setExported] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  async function call(label: string, url: string, init: RequestInit, okText: string, refresh = true) {
    setBusy(label);
    setMsg(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: errText(data, "Action failed") });
        return null;
      }
      setMsg({ kind: "ok", text: okText });
      if (refresh) router.refresh();
      return data;
    } catch {
      setMsg({ kind: "err", text: "Network error" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  const patch = (label: string, body: Record<string, unknown>, okText: string) =>
    call(label, "/api/admin/users", { method: "PATCH", body: JSON.stringify({ id: user.id, ...body }) }, okText);

  async function generateLink() {
    setCopied(false);
    const data = await call("reset", `/api/admin/users/${user.id}/reset-link`, { method: "POST" }, "Reset link created. It is shown only once.");
    if (data?.url) {
      setResetLink({
        url: data.url,
        expires: new Date(data.expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      });
    }
  }

  async function copyLink() {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink.url);
      setCopied(true);
    } catch {
      const el = document.getElementById("reset-link-input") as HTMLInputElement | null;
      el?.select();
      setCopied(document.execCommand?.("copy") ?? false);
    }
  }

  async function doExport() {
    setBusy("export");
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/export`);
      if (!res.ok) {
        setMsg({ kind: "err", text: errText(await res.json().catch(() => ({})), "Export failed") });
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] || `fridgeforge-user-${user.id}.json`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 5000);
      setExported(true);
      setMsg({ kind: "ok", text: "Export downloaded." });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error" });
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    const data = await call(
      "delete",
      `/api/admin/users/${user.id}`,
      { method: "DELETE", body: JSON.stringify({ confirmEmail }) },
      "User deleted.",
      false
    );
    if (data?.ok) router.push("/admin/users");
  }

  const makingAdmin = user.role !== "admin";
  const canChangeRole = makingAdmin || (!isSelf && !isLastAdmin);
  const canSuspend = !isSelf && !(isLastAdmin && user.role === "admin");
  const canDelete = !isSelf && !(isLastAdmin && user.role === "admin");
  const emailMatches = confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

  return (
    <section className="card p-5" data-testid="admin-actions">
      <h2 className="mb-3 font-display text-lg font-bold text-sage-900">Admin actions</h2>
      {msg && (
        <p
          role="status"
          className={clsx(
            "mb-3 rounded-xl px-3 py-2 text-sm",
            msg.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          )}
          data-testid="action-msg"
        >
          {msg.text}
        </p>
      )}

      <div className={rowCls}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-sage-900">Reset password</div>
            <p className="text-xs text-sage-600">
              Creates a one-time link (expires in 1 h). No email is sent — copy it and send it yourself.
            </p>
          </div>
          <button type="button" className={smBtn} disabled={!!busy} onClick={generateLink} data-testid="btn-reset-link">
            {busy === "reset" ? "Working…" : "Generate link"}
          </button>
        </div>
        {resetLink && (
          <div className="mt-2.5 rounded-xl border border-green-200 bg-green-50 p-2.5">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-xs font-semibold text-green-800">✓ Link ready</span>
              <input
                id="reset-link-input"
                readOnly
                value={resetLink.url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-green-200 bg-white px-2 py-1 font-mono text-xs text-sage-800"
                data-testid="reset-link-input"
                aria-label="One-time reset link"
              />
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={copyLink} data-testid="btn-copy-link">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-green-800">
              Shown once — it won&apos;t be displayed again. Valid until {resetLink.expires}. Using it signs the user out everywhere.
            </p>
          </div>
        )}
      </div>

      <div className={rowCls}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-sage-900">Sign out everywhere</div>
            <p className="text-xs text-sage-600">
              {activeSessions} active {activeSessions === 1 ? "session" : "sessions"}
            </p>
          </div>
          <button
            type="button"
            className={smBtn}
            disabled={!!busy}
            onClick={() =>
              call("revoke", `/api/admin/users/${user.id}/revoke-sessions`, { method: "POST" }, "All sessions ended.")
            }
            data-testid="btn-revoke"
          >
            {busy === "revoke" ? "Working…" : "Revoke"}
          </button>
        </div>
      </div>

      <div className={rowCls}>
        {user.disabled ? (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-sage-900">Account suspended</div>
              <p className="text-xs text-sage-600">{user.disabledSummary}</p>
              {user.disabledReason && <p className="mt-0.5 text-xs text-red-800">Reason: {user.disabledReason}</p>}
            </div>
            <button
              type="button"
              className={smBtn}
              disabled={!!busy}
              onClick={() => patch("unsuspend", { disabled: false }, "Account unsuspended.")}
              data-testid="btn-unsuspend"
            >
              Unsuspend
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-sage-900">Suspend account</div>
                <p className="text-xs text-sage-600">
                  {canSuspend
                    ? "Blocks sign-in and ends sessions. The reason is logged."
                    : isSelf
                      ? "You can't suspend yourself."
                      : "Can't suspend the last admin."}
                </p>
              </div>
              <button
                type="button"
                className="btn px-3 py-1.5 text-[13px] border border-red-300 bg-white text-red-700 hover:bg-red-50"
                disabled={!!busy || !canSuspend}
                onClick={() => setSuspendOpen((o) => !o)}
                data-testid="btn-suspend-open"
              >
                Suspend…
              </button>
            </div>
            {suspendOpen && canSuspend && (
              <div className="mt-2.5 space-y-2">
                <label className="label" htmlFor="suspend-reason">
                  Reason (required)
                </label>
                <textarea
                  id="suspend-reason"
                  className="input min-h-[64px]"
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  data-testid="suspend-reason"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-ghost px-3 py-1.5 text-[13px]" onClick={() => setSuspendOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn px-3 py-1.5 text-[13px] bg-red-700 text-white hover:bg-red-800"
                    disabled={!!busy || !reason.trim()}
                    onClick={async () => {
                      const ok = await patch("suspend", { disabled: true, reason }, "Account suspended and signed out.");
                      if (ok) {
                        setSuspendOpen(false);
                        setReason("");
                      }
                    }}
                    data-testid="btn-suspend-confirm"
                  >
                    Suspend account
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className={rowCls}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-sage-900">{makingAdmin ? "Make admin" : "Remove admin"}</div>
            <p className="text-xs text-sage-600">
              {makingAdmin
                ? "Full access to Site ops. Requires confirm."
                : isSelf
                  ? "You can't remove your own admin role."
                  : isLastAdmin
                    ? "Can't remove the last admin."
                    : "Back to a regular account."}
            </p>
          </div>
          {!roleConfirm ? (
            <button
              type="button"
              className={smBtn}
              disabled={!!busy || !canChangeRole}
              onClick={() => setRoleConfirm(true)}
              data-testid="btn-role"
            >
              {makingAdmin ? "Make admin" : "Remove admin"}
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button type="button" className="btn-ghost px-2.5 py-1.5 text-[13px]" onClick={() => setRoleConfirm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-[13px]"
                disabled={!!busy}
                onClick={async () => {
                  await patch(
                    "role",
                    { role: makingAdmin ? "admin" : "user" },
                    makingAdmin ? "User is now an admin." : "Admin role removed."
                  );
                  setRoleConfirm(false);
                }}
                data-testid="btn-role-confirm"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={rowCls}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-sage-900">Plan</div>
            <p className="text-xs text-sage-600">Same API as before (PATCH /api/admin/users).</p>
          </div>
          <select
            className="select w-auto py-1.5 text-[13px]"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            aria-label="Plan"
            data-testid="plan-select"
          >
            <option value="community">Community</option>
            <option value="pro">Pro</option>
          </select>
          <button
            type="button"
            className={smBtn}
            disabled={!!busy || plan === user.plan}
            onClick={() => patch("plan", { plan }, `Plan changed to ${plan === "pro" ? "Pro" : "Community"}.`)}
            data-testid="btn-plan-save"
          >
            Save
          </button>
        </div>
      </div>

      <div className={rowCls}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-sage-900">Export data</div>
            <p className="text-xs text-sage-600">Everything we hold for this user as JSON (no password or tokens).</p>
          </div>
          <button type="button" className={smBtn} disabled={!!busy} onClick={doExport} data-testid="btn-export">
            {busy === "export" ? "Exporting…" : "Download JSON"}
          </button>
        </div>
      </div>

      <div className="mt-1 rounded-2xl border border-red-200 bg-red-50/60 p-4" data-testid="delete-box">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-red-800">Delete user — permanent</h3>
        {canDelete ? (
          <>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-red-900">
              {deletePreview.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <ol className="mt-3 space-y-3 text-xs text-sage-800">
              <li>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">1. Export first</span>
                  {exported ? (
                    <span className="badge bg-green-100 font-semibold text-green-800">✓ Exported</span>
                  ) : (
                    <button type="button" className={smBtn} disabled={!!busy} onClick={doExport} data-testid="btn-export-delete">
                      Download export
                    </button>
                  )}
                </div>
              </li>
              <li>
                <label className="label text-red-800" htmlFor="confirm-email">
                  2. Type the email to confirm
                </label>
                <input
                  id="confirm-email"
                  className="input border-red-200"
                  placeholder={user.email}
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  disabled={!exported}
                  autoComplete="off"
                  data-testid="confirm-email"
                />
              </li>
            </ol>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="btn px-3 py-1.5 text-[13px] bg-red-700 text-white hover:bg-red-800"
                disabled={!!busy || !exported || !emailMatches}
                onClick={doDelete}
                data-testid="btn-delete"
              >
                {busy === "delete" ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs text-red-900">
            {isSelf ? "You can't delete your own account here." : "Can't delete the last admin."}
          </p>
        )}
      </div>
    </section>
  );
}
