"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password-rules";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not reset password");
        return;
      }
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-3 space-y-3 text-sm text-sage-700" data-testid="reset-done">
        <p className="rounded-xl bg-green-50 px-3 py-2 text-green-800">
          Password updated. You&apos;ve been signed out on every device — sign in with your new password.
        </p>
        <Link href="/account" className="btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3" data-testid="reset-form">
      <div>
        <label className="label" htmlFor="rp-new">
          New password
        </label>
        <input
          id="rp-new"
          type="password"
          className="input"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="mt-1 text-[11px] text-sage-500">At least {PASSWORD_MIN} characters.</p>
      </div>
      <div>
        <label className="label" htmlFor="rp-confirm">
          Confirm new password
        </label>
        <input
          id="rp-confirm"
          type="password"
          className="input"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && (
        <p className="text-sm text-ember-700" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
