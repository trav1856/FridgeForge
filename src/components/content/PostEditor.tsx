"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { jsonFetch, uploadContentImage } from "./api";
import { parseYoutubeVideoId, youtubeThumbnailUrl } from "@/lib/origin-story-media";

export type EditablePost = {
  id: string;
  slug: string;
  kind: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  bodyHtml: string;
  tags: string[];
  relatedRecipeIds: string[];
  status: string;
  effectiveStatus: string;
  publishedAt: string | null;
  sponsorLabel: string | null;
  profileId: string | null;
  reviewNote: string | null;
};

type Caps = { isAdmin: boolean; canPublish: boolean; canEdit: boolean };

const STATUS_LABEL: Record<string, string> = { draft: "Draft", review: "In review", scheduled: "Scheduled", published: "Published" };

function placeholderFor(id: string) {
  return `<div data-youtube="${id}" contenteditable="false" class="my-3 flex items-center gap-3 rounded-xl border border-cream-300 bg-cream-100 p-2 text-sm text-sage-700"><img src="${youtubeThumbnailUrl(id)}" alt="" class="h-14 w-24 rounded object-cover"/>▶ YouTube video ${id}</div>`;
}
/** Stored embeds → light placeholders inside the editor (the server rebuilds the iframe). */
function toEditorHtml(html: string) {
  return html.replace(/<div class="ff-embed" data-youtube="([A-Za-z0-9_-]{11})">[\s\S]*?<\/div>/g, (_m, id) => placeholderFor(id));
}

function toLocalInput(d: string | null) {
  if (!d) return "";
  const t = new Date(d);
  const off = t.getTimezoneOffset();
  return new Date(t.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function PostEditor({ initial, caps, recipes, chefs }: {
  initial: EditablePost;
  caps: Caps;
  recipes: { id: string; title: string }[];
  chefs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [kind, setKind] = useState(initial.kind);
  const [excerpt, setExcerpt] = useState(initial.excerpt ?? "");
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [related, setRelated] = useState<string[]>(initial.relatedRecipeIds);
  const [sponsor, setSponsor] = useState(initial.sponsorLabel ?? "");
  const [profileId, setProfileId] = useState(initial.profileId ?? "");
  // Local-time values are filled in after mount so server and browser markup match.
  const [publishAt, setPublishAt] = useState("");
  const [goLive, setGoLive] = useState("");
  const [recipeFilter, setRecipeFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const readOnly = !caps.canEdit;

  useEffect(() => {
    setPublishAt(toLocalInput(post.status === "scheduled" ? post.publishedAt : null));
    setGoLive(post.status === "scheduled" && post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "");
  }, [post.status, post.publishedAt]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = toEditorHtml(initial.bodyHtml);
  }, [initial.bodyHtml]);

  const filteredRecipes = useMemo(() => {
    const q = recipeFilter.trim().toLowerCase();
    return recipes.filter((r) => related.includes(r.id) || !q || r.title.toLowerCase().includes(q)).slice(0, 40);
  }, [recipes, recipeFilter, related]);

  function exec(cmd: string, value?: string) {
    if (readOnly) return;
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
    setDirty(true);
  }

  async function insertPhoto(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const url = await uploadContentImage(f);
      exec("insertHTML", `<figure><img src="${url}" alt=""></figure><p><br></p>`);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
      if (imgRef.current) imgRef.current.value = "";
    }
  }

  function insertYoutube() {
    const url = window.prompt("Paste a YouTube link");
    if (!url) return;
    const id = parseYoutubeVideoId(url);
    if (!id) {
      setMsg({ ok: false, text: "That doesn't look like a YouTube link." });
      return;
    }
    exec("insertHTML", `${placeholderFor(id)}<p><br></p>`);
  }

  function insertLink() {
    const url = window.prompt("Link address (https://…)");
    if (url) exec("createLink", url);
  }

  async function onCover(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      setCoverUrl(await uploadContentImage(f));
      setDirty(true);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
      if (coverRef.current) coverRef.current.value = "";
    }
  }

  async function save(quiet = false): Promise<boolean> {
    if (readOnly) return true;
    setBusy(true);
    if (!quiet) setMsg(null);
    try {
      const body: Record<string, unknown> = {
        title,
        kind,
        excerpt: excerpt || null,
        coverUrl,
        bodyHtml: bodyRef.current?.innerHTML ?? "",
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        relatedRecipeIds: related,
      };
      if (caps.isAdmin) {
        body.sponsorLabel = sponsor || null;
        body.profileId = profileId || null;
      }
      const data = await jsonFetch<{ post: EditablePost }>(`/api/content/posts/${post.id}`, "PATCH", body);
      setPost((p) => ({ ...p, ...data.post }));
      setDirty(false);
      if (!quiet) setMsg({ ok: true, text: "Saved." });
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, extra: Record<string, unknown> = {}, okText = "Done.") {
    if (!(await save(true))) return;
    setBusy(true);
    try {
      const data = await jsonFetch<{ post: EditablePost }>(`/api/content/posts/${post.id}/action`, "POST", { action, ...extra });
      setPost((p) => ({ ...p, ...data.post }));
      setMsg({ ok: true, text: okText });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    setBusy(true);
    try {
      await jsonFetch(`/api/content/posts/${post.id}`, "DELETE");
      router.push(caps.isAdmin ? "/admin/posts" : "/studio");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setBusy(false);
    }
  }

  const status = post.status;
  const live = status === "published" || (status === "scheduled" && post.effectiveStatus === "published");

  return (
    <div className="space-y-5" data-testid="post-editor" data-status={status}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge bg-sage-800 text-cream-50" data-testid="post-status">{STATUS_LABEL[post.effectiveStatus] ?? status}</span>
        {goLive && post.effectiveStatus !== "published" && <span className="text-xs text-sage-600">goes live {goLive}</span>}
        <Link href={`/kitchen-table/${post.slug}`} className="ml-auto text-sm font-semibold text-ember-700 hover:underline" data-testid="post-preview-link" target="_blank">
          {live ? "View post" : "Preview"}
        </Link>
      </div>
      {post.reviewNote && status === "draft" && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Reviewer note: {post.reviewNote}</p>
      )}
      {readOnly && (
        <p className="rounded-xl border border-cream-300 bg-cream-100 p-3 text-sm text-sage-700">
          This post is live. Ask an admin to unpublish it if it needs changes.
        </p>
      )}

      <div>
        <label className="label" htmlFor="pe-title">Title</label>
        <input id="pe-title" className="input text-lg font-semibold" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} maxLength={160} disabled={readOnly} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pe-kind">Type</label>
          <select id="pe-kind" className="select" value={kind} onChange={(e) => { setKind(e.target.value); setDirty(true); }} disabled={readOnly}>
            <option value="article">Article</option>
            <option value="howto">How-to</option>
            {caps.isAdmin && <option value="announcement">Announcement</option>}
          </select>
        </div>
        {caps.isAdmin && (
          <div>
            <label className="label" htmlFor="pe-sponsor">Label</label>
            <select id="pe-sponsor" className="select" value={sponsor} onChange={(e) => { setSponsor(e.target.value); setDirty(true); }}>
              <option value="">None</option>
              <option value="Sponsored">Sponsored</option>
              <option value="Partner">Partner</option>
            </select>
          </div>
        )}
        {caps.isAdmin && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pe-chef">Chef author</label>
            <select id="pe-chef" className="select" value={profileId} onChange={(e) => { setProfileId(e.target.value); setDirty(true); }}>
              <option value="">FridgeForge (no chef)</option>
              {chefs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="label" htmlFor="pe-excerpt">Short summary</label>
        <textarea id="pe-excerpt" className="input min-h-[60px]" value={excerpt} onChange={(e) => { setExcerpt(e.target.value); setDirty(true); }} maxLength={400} disabled={readOnly} />
      </div>

      <div>
        <span className="label">Cover photo</span>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {coverUrl ? <img src={coverUrl} alt="" className="h-24 w-40 rounded-xl object-cover" data-testid="cover-preview" /> : <div className="flex h-24 w-40 items-center justify-center rounded-xl bg-cream-200 text-xs text-sage-500">No cover</div>}
          {!readOnly && (
            <>
              <label className="btn-secondary cursor-pointer px-3 py-1.5 text-sm">
                {coverUrl ? "Replace" : "Upload cover"}
                <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Cover photo" onChange={(e) => onCover(e.target.files?.[0])} />
              </label>
              {coverUrl && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => { setCoverUrl(null); setDirty(true); }}>Remove</button>}
            </>
          )}
        </div>
      </div>

      <div>
        <span className="label">Story</span>
        {!readOnly && (
          <div className="mt-1 flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-cream-300 bg-cream-100 p-1.5" role="toolbar" aria-label="Formatting">
            {[
              ["Heading", () => exec("formatBlock", "h2")],
              ["Subheading", () => exec("formatBlock", "h3")],
              ["Paragraph", () => exec("formatBlock", "p")],
              ["Bold", () => exec("bold")],
              ["Italic", () => exec("italic")],
              ["List", () => exec("insertUnorderedList")],
              ["Numbered", () => exec("insertOrderedList")],
              ["Quote", () => exec("formatBlock", "blockquote")],
              ["Link", insertLink],
            ].map(([label, fn]) => (
              <button key={label as string} type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-sage-700 hover:bg-white" onMouseDown={(e) => e.preventDefault()} onClick={fn as () => void}>
                {label as string}
              </button>
            ))}
            <label className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-sage-700 hover:bg-white">
              + Photo
              <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Insert photo" onChange={(e) => insertPhoto(e.target.files?.[0])} />
            </label>
            <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-sage-700 hover:bg-white" onMouseDown={(e) => e.preventDefault()} onClick={insertYoutube} data-testid="insert-youtube">
              + YouTube
            </button>
          </div>
        )}
        <div
          ref={bodyRef}
          className={`ff-prose ff-editor min-h-[260px] border border-cream-300 bg-white p-4 focus:outline-none focus:ring-2 focus:ring-ember-300 ${readOnly ? "rounded-xl" : "rounded-b-xl"}`}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          data-placeholder="Tell the story…"
          data-testid="post-body-editor"
          role="textbox"
          aria-multiline="true"
          aria-label="Post body"
          onInput={() => setDirty(true)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pe-tags">Tags <span className="font-normal text-sage-500">(comma separated)</span></label>
          <input id="pe-tags" className="input" value={tags} onChange={(e) => { setTags(e.target.value); setDirty(true); }} disabled={readOnly} placeholder="weeknight, budget" />
        </div>
        <div>
          <label className="label" htmlFor="pe-recipes">Related recipes</label>
          <input id="pe-recipes" className="input" value={recipeFilter} onChange={(e) => setRecipeFilter(e.target.value)} placeholder="Search recipes" disabled={readOnly} />
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-cream-300 bg-white p-2 text-sm">
            {filteredRecipes.map((r) => (
              <li key={r.id}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={related.includes(r.id)} disabled={readOnly} onChange={(e) => { setRelated((cur) => (e.target.checked ? [...cur, r.id] : cur.filter((x) => x !== r.id))); setDirty(true); }} />
                  {r.title}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-cream-300 bg-cream-50/95 px-4 py-3 backdrop-blur">
        {!readOnly && <button type="button" className="btn-secondary" disabled={busy} onClick={() => save()} data-testid="post-save">{dirty ? "Save draft" : "Saved"}</button>}
        {status === "draft" && !caps.isAdmin && (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => act("submit", {}, "Submitted for review.")} data-testid="post-submit">Submit for review</button>
        )}
        {caps.canPublish && status !== "published" && (
          <>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => act("publish", { publishAt: null }, "Published.")} data-testid="post-publish">
              {status === "review" && caps.isAdmin ? "Approve & publish" : "Publish now"}
            </button>
            <span className="flex items-center gap-1.5">
              <input type="datetime-local" className="input w-auto py-1.5 text-sm" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} aria-label="Publish at" data-testid="post-publish-at" />
              <button type="button" className="btn-secondary" disabled={busy || !publishAt} onClick={() => act("publish", { publishAt: new Date(publishAt).toISOString() }, "Scheduled.")} data-testid="post-schedule">Schedule</button>
            </span>
          </>
        )}
        {caps.isAdmin && status === "review" && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => { const note = window.prompt("Note for the author (optional)") ?? ""; void act("reject", { note }, "Sent back to draft."); }} data-testid="post-reject">Send back</button>
        )}
        {caps.canPublish && (status === "published" || status === "scheduled") && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => act("unpublish", {}, "Unpublished.")} data-testid="post-unpublish">Unpublish</button>
        )}
        {(caps.isAdmin || status === "draft" || status === "review") && (
          <button type="button" className="btn-ghost ml-auto text-red-700" disabled={busy} onClick={remove} data-testid="post-delete">Delete</button>
        )}
        {msg && <span role="status" className={`w-full text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`} data-testid="post-msg">{msg.text}</span>}
      </div>
    </div>
  );
}
