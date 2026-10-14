"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { jsonFetch, uploadContentImage } from "./api";

export type EditableProfile = {
  id?: string;
  name: string;
  slug?: string;
  bio: string | null;
  photoUrl: string | null;
  credentials: string[];
  links: { label: string; url: string }[];
  youtubeUrl: string | null;
};

/** Chef profile form. endpoint = /api/content/profile (own) or /api/admin/chefs[/id] (admin). */
export function ProfileEditor({ initial, endpoint, method, onSaved, submitLabel = "Save profile" }: {
  initial: EditableProfile;
  endpoint: string;
  method: "PATCH" | "POST";
  onSaved?: (p: EditableProfile) => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [creds, setCreds] = useState(initial.credentials.join("\n"));
  const [links, setLinks] = useState(initial.links.map((l) => `${l.label} | ${l.url}`).join("\n"));
  const [yt, setYt] = useState(initial.youtubeUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = initial.id ?? "new";

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      setPhotoUrl(await uploadContentImage(f));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body = {
        name,
        bio: bio || null,
        photoUrl,
        credentials: creds.split("\n").map((s) => s.trim()).filter(Boolean),
        links: links.split("\n").map((s) => s.trim()).filter(Boolean).map((line) => {
          const [a, b] = line.includes("|") ? line.split("|").map((x) => x.trim()) : ["", line];
          return { label: a || undefined, url: b || "" };
        }),
        youtubeUrl: yt.trim() || null,
      };
      const data = await jsonFetch<{ profile?: EditableProfile; chef?: EditableProfile }>(endpoint, method, body);
      setMsg({ ok: true, text: "Saved." });
      const saved = data.profile ?? data.chef;
      if (saved) onSaved?.(saved);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4" data-testid="profile-editor">
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-sm" data-testid="profile-photo" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-200 text-xs text-sage-500">No photo</div>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer px-3 py-1.5 text-sm">
            {photoUrl ? "Replace photo" : "Upload photo"}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Chef photo" onChange={(e) => onPhoto(e.target.files?.[0])} disabled={busy} />
          </label>
          {photoUrl && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setPhotoUrl(null)}>Remove</button>}
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`pe-name-${id}`}>Name</label>
        <input id={`pe-name-${id}`} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      </div>
      <div>
        <label className="label" htmlFor={`pe-bio-${id}`}>Bio</label>
        <textarea id={`pe-bio-${id}`} className="input min-h-[100px]" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} />
      </div>
      <div>
        <label className="label" htmlFor={`pe-creds-${id}`}>Credentials <span className="font-normal text-sage-500">(one per line)</span></label>
        <textarea id={`pe-creds-${id}`} className="input min-h-[70px]" value={creds} onChange={(e) => setCreds(e.target.value)} placeholder={"Culinary school graduate\n12 years as a line cook"} />
      </div>
      <div>
        <label className="label" htmlFor={`pe-yt-${id}`}>YouTube channel</label>
        <input id={`pe-yt-${id}`} className="input" value={yt} onChange={(e) => setYt(e.target.value)} placeholder="https://www.youtube.com/@yourchannel" />
      </div>
      <div>
        <label className="label" htmlFor={`pe-links-${id}`}>Links <span className="font-normal text-sage-500">(one per line: Label | https://…)</span></label>
        <textarea id={`pe-links-${id}`} className="input min-h-[70px]" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="Website | https://example.com" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy} data-testid="profile-save">{submitLabel}</button>
        {msg && <span role="status" className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>{msg.text}</span>}
      </div>
    </form>
  );
}
