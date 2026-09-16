"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { RecipeRequestsInbox } from "@/components/RecipeRequestsInbox";
import { HowToBadgesPanel } from "@/components/HowToBadgesPanel";
import { applyMacroPrefToggle, applyPlantPrefToggle } from "@/lib/dietary";

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
  preferCarnivore?: boolean;
  preferAtkins?: boolean;
  preferLowCarb?: boolean;
  preferLowSugar?: boolean;
  preferLowSodium?: boolean;
  households: Household[];
};


function PrefChip({
  label,
  checked,
  disabled,
  helper,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  helper?: string;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={checked}
        onClick={() => onToggle(!checked)}
        className={clsx(
          "rounded-full px-3.5 py-2 text-sm transition",
          checked
            ? "bg-ember-600 font-semibold text-white shadow-sm"
            : "border border-sage-200 bg-cream-50 font-medium text-sage-800 hover:border-sage-300 hover:bg-white",
          disabled && "cursor-not-allowed opacity-50 hover:border-sage-200 hover:bg-cream-50"
        )}
      >
        {label}
      </button>
      {helper ? (
        <p className="mt-1 max-w-[11rem] text-[11px] leading-snug text-sage-500">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-sage-900">
                Dietary preferences
              </h2>
              <Link
                href="/account/dietary"
                className="text-xs font-semibold text-ember-700 hover:underline"
              >
                Learn more about dietary restrictions
              </Link>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">
                Religion
              </p>
              <div className="flex flex-wrap gap-2">
                <PrefChip
                  label="Jewish"
                  checked={Boolean(user.isJewish)}
                  disabled={busy}
                  onToggle={(next) =>
                    void savePrefs({
                      isJewish: next,
                      ...(next ? {} : { isObservant: false }),
                    })
                  }
                />
                <PrefChip
                  label="Muslim"
                  checked={Boolean(user.isMuslim)}
                  disabled={busy}
                  onToggle={(next) => void savePrefs({ isMuslim: next })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">
                Food preferences
              </p>
              <div className="flex flex-wrap gap-2">
                <PrefChip
                  label="Observant"
                  checked={Boolean(user.isJewish && user.isObservant)}
                  disabled={busy || !user.isJewish}
                  helper={!user.isJewish ? "Requires Jewish" : undefined}
                  onToggle={(next) =>
                    void savePrefs({
                      isObservant: next,
                      ...(next ? { preferHalal: false } : {}),
                    })
                  }
                />
                <PrefChip
                  label="Prefer kosher"
                  checked={Boolean(user.preferKosher)}
                  disabled={busy}
                  onToggle={(next) =>
                    void savePrefs({
                      preferKosher: next,
                      ...(next ? { preferHalal: false } : {}),
                    })
                  }
                />
                <PrefChip
                  label="Prefer Halal"
                  checked={
                    Boolean(user.preferHalal) &&
                    !(
                      Boolean(user.preferKosher) ||
                      (Boolean(user.isJewish) && Boolean(user.isObservant))
                    )
                  }
                  disabled={
                    busy ||
                    Boolean(user.preferKosher) ||
                    (Boolean(user.isJewish) && Boolean(user.isObservant))
                  }
                  helper={
                    Boolean(user.preferKosher) ||
                    (Boolean(user.isJewish) && Boolean(user.isObservant))
                      ? "Cleared while Kosher food is on"
                      : undefined
                  }
                  onToggle={(next) => void savePrefs({ preferHalal: next })}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-cream-300 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">
                Plant-based
              </p>
              <div className="flex flex-wrap gap-2">
                <PrefChip
                  label="Vegan"
                  checked={Boolean(user.preferVegan) && !user.preferCarnivore}
                  disabled={busy || Boolean(user.preferCarnivore)}
                  helper={
                    user.preferCarnivore
                      ? "Incompatible with carnivore"
                      : undefined
                  }
                  onToggle={(next) => {
                    const patch = applyPlantPrefToggle(user, "preferVegan", next);
                    void savePrefs(patch);
                  }}
                />
                <PrefChip
                  label="Vegetarian"
                  checked={Boolean(user.preferVegetarian) && !user.preferCarnivore}
                  disabled={
                    busy ||
                    Boolean(user.preferCarnivore) ||
                    Boolean(user.preferVegan)
                  }
                  helper={
                    user.preferCarnivore
                      ? "Incompatible with carnivore"
                      : user.preferVegan
                      ? "Implied by vegan"
                      : undefined
                  }
                  onToggle={(next) => {
                    const patch = applyPlantPrefToggle(
                      user,
                      "preferVegetarian",
                      next
                    );
                    void savePrefs(patch);
                  }}
                />
                <PrefChip
                  label="Pescatarian"
                  checked={Boolean(user.preferPescatarian) && !user.preferCarnivore}
                  disabled={
                    busy ||
                    Boolean(user.preferCarnivore) ||
                    Boolean(user.preferVegan) ||
                    Boolean(user.preferVegetarian)
                  }
                  helper={
                    user.preferCarnivore
                      ? "Incompatible with carnivore"
                      : user.preferVegan || user.preferVegetarian
                      ? "Off while vegan/vegetarian is on"
                      : undefined
                  }
                  onToggle={(next) => {
                    const patch = applyPlantPrefToggle(
                      user,
                      "preferPescatarian",
                      next
                    );
                    void savePrefs(patch);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-cream-300 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">
                Dietary restrictions
              </p>
              <div className="flex flex-wrap gap-2">
                <PrefChip
                  label="Carnivore"
                  checked={Boolean(user.preferCarnivore)}
                  disabled={busy}
                  helper="Incompatible with plant-based"
                  onToggle={(next) => {
                    const patch = applyMacroPrefToggle(
                      user,
                      "preferCarnivore",
                      next
                    );
                    void savePrefs(patch);
                  }}
                />
                <PrefChip
                  label="Atkins"
                  checked={Boolean(user.preferAtkins)}
                  disabled={busy}
                  onToggle={(next) => {
                    const patch = applyMacroPrefToggle(
                      user,
                      "preferAtkins",
                      next
                    );
                    void savePrefs(patch);
                  }}
                />
                <PrefChip
                  label="Low carb"
                  checked={Boolean(user.preferLowCarb)}
                  disabled={busy}
                  onToggle={(next) => {
                    const patch = applyMacroPrefToggle(
                      user,
                      "preferLowCarb",
                      next
                    );
                    void savePrefs(patch);
                  }}
                />
                <PrefChip
                  label="Low sugar"
                  checked={Boolean(user.preferLowSugar)}
                  disabled={busy}
                  onToggle={(next) => {
                    const patch = applyMacroPrefToggle(
                      user,
                      "preferLowSugar",
                      next
                    );
                    void savePrefs(patch);
                  }}
                />
                <PrefChip
                  label="Low sodium"
                  checked={Boolean(user.preferLowSodium)}
                  disabled={busy}
                  onToggle={(next) => {
                    const patch = applyMacroPrefToggle(
                      user,
                      "preferLowSodium",
                      next
                    );
                    void savePrefs(patch);
                  }}
                />
              </div>
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
