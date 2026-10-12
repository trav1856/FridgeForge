"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ProfileImageField } from "@/components/profile/ProfileImageField";
import { BIO_MAX, DISPLAY_NAME_MAX, HANDLE_MAX } from "@/lib/profile-fields";

type Candidate = { id: string; title: string; imageUrl: string | null; visibility: string; authorName: string | null };
type OwnerProfile = {
  profile: {
    displayName: string;
    handle: string;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    socialX: string | null;
    socialFacebook: string | null;
  };
  profilePublic: boolean;
  ageConfirmed: boolean;
  pins: { own: string[]; favorite: string[] };
  candidates: { own: Candidate[]; favorite: Candidate[] };
};

const MAX = 3;
const PLACEHOLDER = "/recipe-images/placeholder.svg";

function PinPicker({
  title,
  hint,
  candidates,
  pinned,
  onChange,
  testId,
  empty,
}: {
  title: string;
  hint: string;
  candidates: Candidate[];
  pinned: string[];
  onChange: (ids: string[]) => void;
  testId: string;
  empty: React.ReactNode;
}) {
  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const pinnedRows = pinned.map((id) => byId.get(id)).filter((c): c is Candidate => Boolean(c));
  const rest = candidates.filter((c) => !pinned.includes(c.id));
  const full = pinned.length >= MAX;
  const move = (i: number, d: number) => {
    const next = [...pinned];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const row = (c: Candidate, i: number | null) => (
    <li
      key={c.id}
      className={clsx(
        "flex items-center gap-3 rounded-xl border px-2.5 py-2",
        i !== null ? "border-ember-100 bg-white" : "border-cream-300/80 bg-cream-50/60"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.imageUrl || PLACEHOLDER} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-sage-900">{c.title}</div>
        <div className="truncate text-xs text-sage-500">
          {c.authorName ? `by ${c.authorName}` : c.visibility === "household" ? "Household only: visitors outside your household won't see it" : "Visible to visitors"}
        </div>
      </div>
      {i !== null ? (
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className="btn-ghost px-2 py-1 text-xs" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === pinned.length - 1}>↓</button>
          <button type="button" className="btn-ghost px-2 py-1 text-xs font-semibold text-ember-700" onClick={() => onChange(pinned.filter((x) => x !== c.id))}>
            Unpin
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn-ghost shrink-0 px-2 py-1 text-xs font-semibold"
          disabled={full}
          onClick={() => onChange([...pinned, c.id])}
          data-testid={`${testId}-pin`}
        >
          + Pin
        </button>
      )}
    </li>
  );
  return (
    <section className="card space-y-3 p-5" data-testid={testId}>
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">{title}</h2>
        <p className="mt-1 text-xs text-sage-500">
          {hint} {pinned.length} of {MAX} pinned.
        </p>
      </div>
      {candidates.length === 0 ? (
        <p className="text-sm text-sage-600">{empty}</p>
      ) : (
        <>
          {pinnedRows.length > 0 && <ul className="space-y-2">{pinnedRows.map((c, i) => row(c, i))}</ul>}
          {rest.length > 0 && (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">{rest.map((c) => row(c, null))}</ul>
          )}
        </>
      )}
    </section>
  );
}

export function ProfileEditor() {
  const [state, setState] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [data, setData] = useState<OwnerProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [socialX, setSocialX] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [birthDate, setBirthDate] = useState("");
  const [own, setOwn] = useState<string[]>([]);
  const [favorite, setFavorite] = useState<string[]>([]);
  const [handleStatus, setHandleStatus] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((d: OwnerProfile) => {
    setData(d);
    setDisplayName(d.profile.displayName);
    setHandle(d.profile.handle);
    setBio(d.profile.bio ?? "");
    setSocialX(d.profile.socialX ?? "");
    setSocialFacebook(d.profile.socialFacebook ?? "");
    setIsPublic(d.profilePublic);
    setOwn(d.pins.own);
    setFavorite(d.pins.favorite);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (res.status === 401) return setState("guest");
        if (!res.ok) return setState("error");
        apply(await res.json());
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, [apply]);

  async function checkHandle() {
    if (!data || handle.trim() === data.profile.handle) return setHandleStatus(null);
    const res = await fetch(`/api/profile/handle?h=${encodeURIComponent(handle)}`);
    const d = await res.json().catch(() => ({}));
    setHandleStatus(d.available ? `✓ Available: /u/${d.handle}` : d.error || "Not available");
  }

  async function save() {
    if (!data) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          handle,
          bio,
          socialX,
          socialFacebook,
          profilePublic: isPublic,
          ...(data.ageConfirmed ? {} : { birthDate }),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFieldErrors(d.fieldErrors ?? {});
        setError(typeof d.error === "string" ? d.error : "Could not save profile.");
        return;
      }
      const pr = await fetch("/api/profile/pins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ own, favorite }),
      });
      const pd = await pr.json().catch(() => ({}));
      if (!pr.ok) {
        apply(d);
        setError(typeof pd.error === "string" ? pd.error : "Could not save pins.");
        return;
      }
      apply(pd);
      setHandleStatus(null);
      setMessage("Profile saved.");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <div className="card p-6 text-sm text-sage-600">Loading profile…</div>;
  if (state === "guest") {
    return (
      <div className="mx-auto max-w-lg card p-6" data-testid="profile-edit-guest">
        <h1 className="font-display text-2xl font-bold text-sage-900">Edit profile</h1>
        <p className="mt-2 text-sm text-sage-600">
          Sign in to set up your profile.{" "}
          <Link href="/account" className="font-semibold text-ember-700 hover:underline">
            Sign in or create an account
          </Link>
        </p>
      </div>
    );
  }
  if (state === "error" || !data) return <div className="card p-6 text-sm text-ember-800">Could not load your profile.</div>;

  const needsAge = !data.ageConfirmed;
  const fe = (k: string) => fieldErrors[k] && <p className="mt-1 text-xs font-medium text-ember-700">{fieldErrors[k]}</p>;

  return (
    <div className="space-y-6" data-testid="profile-editor">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">
            <Link href="/account" className="hover:text-ember-700">Account</Link> / Profile
          </p>
          <h1 className="font-display text-3xl font-bold text-sage-900">Edit profile</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/u/${data.profile.handle}`} className="btn-secondary text-sm">View profile</a>
          <button type="button" className="btn-primary text-sm" onClick={save} disabled={busy} data-testid="profile-save">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-ember-200 bg-ember-50 px-4 py-3 text-sm text-ember-800" role="alert">{error}</div>}
      {message && <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800" role="status">{message}</div>}

      {needsAge && (
        <section className="card space-y-2 border-amber-200 bg-amber-50/70 p-5" data-testid="profile-age-confirm">
          <h2 className="font-semibold text-sage-900">Confirm your age</h2>
          <p className="text-sm text-sage-700">
            Profiles are for cooks 13 and older. Enter your date of birth once to continue; we only check it and don&apos;t save it.
          </p>
          <input type="date" className="input max-w-xs" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} aria-label="Date of birth" autoComplete="bday" />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">Photos</h2>
            {needsAge ? (
              <p className="text-sm text-sage-600">Confirm your age and save to add photos.</p>
            ) : (
              <>
                <div>
                  <p className="label">Banner image</p>
                  <ProfileImageField kind="banner" currentUrl={data.profile.bannerUrl} onChanged={(url) => setData({ ...data, profile: { ...data.profile, bannerUrl: url } })} />
                </div>
                <div>
                  <p className="label">Profile photo</p>
                  <ProfileImageField kind="avatar" currentUrl={data.profile.avatarUrl} onChanged={(url) => setData({ ...data, profile: { ...data.profile, avatarUrl: url } })} />
                </div>
              </>
            )}
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">About you</h2>
            <div>
              <label className="label" htmlFor="pf-name">Display name</label>
              <input id="pf-name" className="input" value={displayName} maxLength={DISPLAY_NAME_MAX} onChange={(e) => setDisplayName(e.target.value)} />
              {fe("displayName")}
            </div>
            <div>
              <label className="label" htmlFor="pf-handle">Handle</label>
              <div className="flex items-center rounded-xl border border-sage-200 bg-white focus-within:border-ember-400 focus-within:ring-2 focus-within:ring-ember-200">
                <span className="pl-3 text-sm text-sage-500">@</span>
                <input
                  id="pf-handle"
                  className="w-full rounded-xl bg-transparent px-1 py-2.5 text-sm text-sage-900 focus:outline-none"
                  value={handle}
                  maxLength={HANDLE_MAX}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  onBlur={checkHandle}
                />
              </div>
              <p className="mt-1 text-xs text-sage-500">
                {handleStatus ?? `Your profile lives at /u/${data.profile.handle}. 3–${HANDLE_MAX} lowercase letters, numbers or hyphens.`}
              </p>
              {fe("handle")}
            </div>
            <div>
              <label className="label" htmlFor="pf-bio">Bio</label>
              <textarea id="pf-bio" className="input min-h-[96px] resize-y" value={bio} maxLength={BIO_MAX} onChange={(e) => setBio(e.target.value)} placeholder="What do you like to cook?" />
              <p className="mt-1 text-right text-xs text-sage-500">{[...bio].length} / {BIO_MAX}</p>
              {fe("bio")}
            </div>
            <div>
              <label className="label" htmlFor="pf-x">X (optional)</label>
              <input id="pf-x" className="input" value={socialX} onChange={(e) => setSocialX(e.target.value)} placeholder="@handle or x.com/handle" />
              {fe("socialX")}
            </div>
            <div>
              <label className="label" htmlFor="pf-fb">Facebook (optional)</label>
              <input id="pf-fb" className="input" value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} placeholder="facebook.com/your-page" />
              {fe("socialFacebook")}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <PinPicker
            title="My top 3 recipes"
            hint="Pin up to 3 of your own recipes."
            candidates={data.candidates.own}
            pinned={own}
            onChange={setOwn}
            testId="pins-own"
            empty={<>You haven&apos;t added any recipes yet. <Link href="/recipes/new" className="font-semibold text-ember-700 hover:underline">Add a recipe</Link></>}
          />
          <PinPicker
            title="Favorites from other cooks"
            hint="Pick up to 3 of your favorites by other cooks. Each card credits the author."
            candidates={data.candidates.favorite}
            pinned={favorite}
            onChange={setFavorite}
            testId="pins-favorite"
            empty={<>Favorite a few recipes from other cooks first. <Link href="/recipes" className="font-semibold text-ember-700 hover:underline">Browse recipes</Link></>}
          />
          <section className="card space-y-3 p-5" data-testid="profile-visibility">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">Visibility</h2>
            <div className="inline-flex rounded-full bg-sage-100 p-1" role="radiogroup" aria-label="Profile visibility">
              {[
                { v: true, label: "🌐 Public" },
                { v: false, label: "🔒 Private" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={isPublic === o.v}
                  onClick={() => setIsPublic(o.v)}
                  data-testid={o.v ? "visibility-public" : "visibility-private"}
                  className={clsx(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                    isPublic === o.v ? "bg-white text-sage-900 shadow-sm" : "text-sage-600 hover:text-sage-900"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-sage-500">
              Public: anyone can see your profile and pinned recipes. Private: everyone else sees only &ldquo;This profile is private&rdquo;.
            </p>
            <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm leading-relaxed text-sage-700">
              🔒 <b>Always private:</b> your allergies, diet preferences, pantry and email are never shown on your profile.
            </div>
          </section>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
