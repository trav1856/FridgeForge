"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  EMAIL_MAX,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  SPLASH_AUTH_EVENT,
  authErrorMessage,
  splashAuthBody,
  validateSplashAuth,
  type SplashAuthEventDetail,
  type SplashAuthMode,
} from "@/lib/splash-auth";

/** Sign in / Create account card on the signed-out splash. Uses the same
 *  /api/auth/signin + /api/auth/signup endpoints as /account. */
export function SplashAuthCard() {
  const [mode, setMode] = useState<SplashAuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const switchMode = useCallback((next: SplashAuthMode) => {
    setMode(next);
    setError(null);
  }, []);

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<SplashAuthEventDetail>).detail;
      if (detail?.mode) switchMode(detail.mode);
      const card = cardRef.current;
      if (card) {
        const rect = card.getBoundingClientRect();
        const headerH = 72;
        if (rect.top < headerH || rect.bottom > window.innerHeight) {
          const reduce = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches;
          card.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
            block: "center",
          });
        }
      }
      emailRef.current?.focus({ preventScroll: true });
    }
    window.addEventListener(SPLASH_AUTH_EVENT, onOpen);
    return () => window.removeEventListener(SPLASH_AUTH_EVENT, onOpen);
  }, [switchMode]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || done) return;
    const input = { email, password, name };
    const invalid = validateSplashAuth(mode, input);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        mode === "signin" ? "/api/auth/signin" : "/api/auth/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(splashAuthBody(mode, input)),
        }
      );
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(authErrorMessage(mode, res.status, data));
        setBusy(false);
        return;
      }
      setPassword("");
      setDone(true);
      // Full navigation so the server re-renders "/" (and the Nav) signed in.
      window.location.assign("/");
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  const submitLabel = done
    ? mode === "signin"
      ? "Signed in — opening your kitchen…"
      : "Account created — opening your kitchen…"
    : busy
      ? mode === "signin"
        ? "Signing in…"
        : "Creating account…"
      : mode === "signin"
        ? "Sign in"
        : "Create account";

  return (
    <div
      ref={cardRef}
      className="card p-5 shadow-[0_12px_40px_rgba(234,88,12,0.18)] sm:p-6"
    >
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold text-sage-900">
          {mode === "signin" ? "Welcome back" : "Create your kitchen"}
        </h2>
        <p className="mt-1 text-sm text-sage-600">
          Sign in or create an account to sync your kitchen.
        </p>
      </div>

      <div
        className="flex gap-2 rounded-2xl bg-sage-100/70 p-1"
        role="tablist"
        aria-label="Account"
      >
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`splash-tab-${m}`}
            aria-selected={mode === m}
            aria-controls="splash-auth-form"
            onClick={() => switchMode(m)}
            className={clsx(
              "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition",
              mode === m
                ? "bg-white text-sage-900 shadow-sm"
                : "text-sage-600 hover:text-sage-900"
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form
        id="splash-auth-form"
        role="tabpanel"
        aria-labelledby={`splash-tab-${mode}`}
        onSubmit={onSubmit}
        noValidate
        className="mt-4 space-y-3"
      >
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="splash-name">
              Name
            </label>
            <input
              id="splash-name"
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              autoComplete="name"
              maxLength={NAME_MAX}
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="splash-email">
            Email
          </label>
          <input
            ref={emailRef}
            id="splash-email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@kitchen.example"
            autoComplete="email"
            maxLength={EMAIL_MAX}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "splash-auth-error" : undefined}
          />
        </div>
        <div>
          <label className="label" htmlFor="splash-password">
            Password
          </label>
          <input
            id="splash-password"
            className="input"
            type="password"
            required
            minLength={mode === "signup" ? PASSWORD_MIN : undefined}
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "signup"
                ? `At least ${PASSWORD_MIN} characters`
                : "Your password"
            }
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "splash-auth-error" : undefined}
          />
        </div>
        {error && (
          <p
            id="splash-auth-error"
            role="alert"
            className="rounded-xl border border-ember-200 bg-ember-50 px-3 py-2 text-sm text-ember-800"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={busy || done}
        >
          {submitLabel}
        </button>
      </form>

      <p className="mt-4 text-center text-xs leading-relaxed text-sage-500">
        Just looking?{" "}
        <Link
          href="/recipes"
          className="font-semibold text-ember-700 underline-offset-2 hover:underline"
        >
          Browse recipes as a guest
        </Link>{" "}
        — no account needed.
      </p>
    </div>
  );
}
