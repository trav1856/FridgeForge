"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { RecipeRequestsInbox } from "@/components/RecipeRequestsInbox";
import { HowToBadgesPanel } from "@/components/HowToBadgesPanel";
import {
  PLANT_PREF_HELP,
  applyPlantPrefToggle,
} from "@/lib/dietary";

type Household = {
  id: string;
  name: string;
  inviteCode: string;
  role: string;
  membershipId?: string;
};

type MeUser = {
  id: string;
  email: string;
  name: string | null;
  profileSlug: string | null;
  plan: string;
  isJewish?: boolean;
  isObservant?: boolean;
  preferKosher?: boolean;
  isMuslim?: boolean;
  preferHalal?: boolean;
  preferVegetarian?: boolean;
  preferPescatarian?: boolean;
  preferVegan?: boolean;
  households: Household[];
};

export default function AccountPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAuth(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        mode === "signin" ? "/api/auth/signin" : "/api/auth/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            ...(mode === "signup" && name ? { name } : {}),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not authenticate"
        );
        return;
      }
      setPassword("");
      setMessage(mode === "signup" ? "Account created." : "Signed in.");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    setBusy(true);
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
    setMessage("Signed out. Guest / Community Edition mode is active.");
    setBusy(false);
  }

  async function savePrefs(patch: Partial<{
    isJewish: boolean;
    isObservant: boolean;
    preferKosher: boolean;
    isMuslim: boolean;
    preferHalal: boolean;
    preferVegetarian: boolean;
    preferPescatarian: boolean;
    preferVegan: boolean;
  }>) {
    if (!user) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save prefs");
        return;
      }
      if (data.user) setUser(data.user);
      setMessage("Dietary preferences saved.");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateHousehold(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: householdName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Create failed");
        return;
      }
      setHouseholdName("");
      setMessage(`Household created. Invite code: ${data.inviteCode}`);
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onJoinHousehold(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/households/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Join failed");
        return;
      }
      setInviteCode("");
      setMessage(
        data.alreadyMember
          ? `Already in ${data.name}.`
          : `Joined ${data.name}.`
      );
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="card p-6 text-sm text-sage-600">Loading account…</div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-sage-900">Account</h1>
        <p className="mt-1 text-sm text-sage-600">
          Sign in for households (paid track scaffold). Guests keep working
          without an account — Community Edition pantry/recipes stay local.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-ember-200 bg-ember-50 px-4 py-3 text-sm text-ember-800">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800">
          {message}
        </div>
      )}

      {!user ? (
        <div className="card p-5 space-y-4">
          <div className="flex gap-2 rounded-2xl bg-sage-100/70 p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={clsx(
                  "flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                  mode === m
                    ? "bg-white text-sage-900 shadow-sm"
                    : "text-sage-600 hover:text-sage-900"
                )}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
          <form onSubmit={onAuth} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="label" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-sage-900">
                  {user.name || user.email}
                </div>
                <div className="text-sm text-sage-600">{user.email}</div>
              </div>
              <span
                className={clsx(
                  "badge",
                  user.plan === "pro"
                    ? "bg-ember-100 text-ember-800"
                    : "bg-sage-100 text-sage-700"
                )}
              >
                {user.plan === "pro" ? "Pro" : "Community"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.profileSlug ? (
                <a
                  href={`/u/${user.profileSlug}`}
                  className="btn-secondary text-sm"
                >
                  View public profile
                </a>
              ) : null}
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={onSignOut}
                disabled={busy}
              >
                Sign out
              </button>
            </div>
            {user.profileSlug ? (
              <p className="text-xs text-sage-600">
                Public URL:{" "}
                <code className="rounded bg-cream-100 px-1.5 py-0.5 font-mono text-sage-800">
                  /u/{user.profileSlug}
                </code>
              </p>
            ) : null}
          </div>

          <RecipeRequestsInbox />

          <HowToBadgesPanel />

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-display text-xl font-bold text-sage-900">
                Dietary preferences
              </h2>
              <p className="mt-1 text-xs text-sage-600">
                Kosher* / Halal* on recipes mean “eligible if you use certified
                ingredients” — not a certification claim. Jewish / Muslim stack
                freely with plant prefs (vegan / vegetarian / pescatarian).
                Observant Jewish hard-filters to kosher-eligible only. Muslim
                soft-prefers halal; Prefer Halal hard-filters. Jewish supersedes
                Halal (kosher without alcohol covers halal — Muslim / Prefer Halal
                are cleared while Jewish is on). {PLANT_PREF_HELP}
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm text-sage-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(user.isJewish)}
                disabled={busy}
                onChange={(e) =>
                  void savePrefs({
                    isJewish: e.target.checked,
                    ...(e.target.checked
                      ? { isMuslim: false, preferHalal: false }
                      : { isObservant: false }),
                  })
                }
              />
              <span>
                <span className="font-semibold">Jewish</span>
                <span className="block text-xs text-sage-600">
                  Soft-boosts kosher-eligible recipes when not observant; unlocks
                  Kosher section.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-sage-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(user.isJewish && user.isObservant)}
                disabled={busy || !user.isJewish}
                onChange={(e) => void savePrefs({ isObservant: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Observant</span>
                <span className="block text-xs text-sage-600">
                  Requires Jewish. Hard-filters suggestions to kosher-eligible
                  only (empty if none).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-sage-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(user.preferKosher)}
                disabled={busy}
                onChange={(e) => void savePrefs({ preferKosher: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Prefer kosher</span>
                <span className="block text-xs text-sage-600">
                  Soft prefer + show Kosher recipes section (does not hard-filter
                  unless Observant is on).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-sage-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(user.isMuslim) && !user.isJewish}
                disabled={busy || Boolean(user.isJewish)}
                onChange={(e) => void savePrefs({ isMuslim: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Muslim</span>
                <span className="block text-xs text-sage-600">
                  Shows Halal section and soft-prefers halal-eligible recipes.
                  Prefer Halal still hard-filters. Disabled while Jewish is on
                  (kosher without alcohol supersedes / covers halal).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-sage-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(user.preferHalal) && !user.isJewish}
                disabled={busy || Boolean(user.isJewish)}
                onChange={(e) => void savePrefs({ preferHalal: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Prefer Halal</span>
                <span className="block text-xs text-sage-600">
                  Shows Halal section and hard-filters Cook Now / Weekly menu to
                  halal-eligible only. Disabled while Jewish is on (kosher covers
                  halal).
                </span>
              </span>
            </label>

            <div className="border-t border-cream-300 pt-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">
                Plant-based
              </p>
              <label className="flex items-start gap-2 text-sm text-sage-800">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={Boolean(user.preferVegan)}
                  disabled={busy}
                  onChange={(e) => {
                    const next = applyPlantPrefToggle(user, "preferVegan", e.target.checked);
                    void savePrefs(next);
                  }}
                />
                <span>
                  <span className="font-semibold">Vegan</span>
                  <span className="block text-xs text-sage-600">
                    Highest priority. Implies vegetarian. Hard-filters to vegan-eligible
                    (or recipes with a vegan adapt note).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-sage-800">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={Boolean(user.preferVegetarian)}
                  disabled={busy || Boolean(user.preferVegan)}
                  onChange={(e) => {
                    const next = applyPlantPrefToggle(
                      user,
                      "preferVegetarian",
                      e.target.checked
                    );
                    void savePrefs(next);
                  }}
                />
                <span>
                  <span className="font-semibold">Vegetarian</span>
                  <span className="block text-xs text-sage-600">
                    {user.preferVegan
                      ? "Implied by vegan (checked automatically)."
                      : "No meat or fish. Incompatible with pescatarian. Adapt notes shown when present."}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-sage-800">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={Boolean(user.preferPescatarian)}
                  disabled={busy || Boolean(user.preferVegan) || Boolean(user.preferVegetarian)}
                  onChange={(e) => {
                    const next = applyPlantPrefToggle(
                      user,
                      "preferPescatarian",
                      e.target.checked
                    );
                    void savePrefs(next);
                  }}
                />
                <span>
                  <span className="font-semibold">Pescatarian</span>
                  <span className="block text-xs text-sage-600">
                    Fish OK, no land meat. Disabled while vegan or vegetarian is on.
                  </span>
                </span>
              </label>
            </div>

          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-display text-xl font-bold text-sage-900">
              Households
            </h2>
            {user.households.length === 0 ? (
              <p className="text-sm text-sage-600">
                No household yet. Create one or join with an invite code. Until
                then, pantry/recipes use guest (null household) scope.
              </p>
            ) : (
              <ul className="space-y-3">
                {user.households.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-xl border border-cream-300 bg-cream-50/80 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-sage-900">{h.name}</div>
                      <span className="badge bg-sage-100 text-sage-700">
                        {h.role}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-sage-600">
                      Invite code:{" "}
                      <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sage-900">
                        {h.inviteCode}
                      </code>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={onCreateHousehold} className="space-y-2 border-t border-cream-300 pt-4">
              <label className="label" htmlFor="hh-name">
                Create household
              </label>
              <div className="flex gap-2">
                <input
                  id="hh-name"
                  className="input"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="Our kitchen"
                  required
                />
                <button type="submit" className="btn-primary shrink-0" disabled={busy}>
                  Create
                </button>
              </div>
            </form>

            <form onSubmit={onJoinHousehold} className="space-y-2">
              <label className="label" htmlFor="invite">
                Join with invite code
              </label>
              <div className="flex gap-2">
                <input
                  id="invite"
                  className="input font-mono uppercase"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="ABCD2345"
                  required
                />
                <button type="submit" className="btn-secondary shrink-0" disabled={busy}>
                  Join
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
