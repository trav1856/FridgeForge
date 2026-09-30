"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  STORY_MEDIA_MAX_ITEMS,
  parseStoryMedia,
  parseYoutubeVideoId,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type StoryMediaItem,
} from "@/lib/origin-story-media";
import {
  stageImage,
  stageYoutube,
  type StagedStoryMediaItem,
} from "@/lib/story-media-staging";

/** Keep in sync with RECIPE_USER_IMAGE_MAX_BYTES in recipe-user-images.ts */
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

type Props = {
  /** Existing recipe id. Media saves immediately via /api/recipes/[id]/story-media. */
  recipeId?: string;
  initialMedia?: StoryMediaItem[] | null;
  /**
   * Create mode (no recipeId yet): items are staged locally and mirrored into this
   * ref; RecipeForm uploads them right after the recipe is created. Pass a stable
   * useRef object so the memoized editor never re-renders while the form types.
   */
  stagedRef?: MutableRefObject<StagedStoryMediaItem[]>;
};

/**
 * Story media editor (photos + YouTube links) for RecipeForm.
 * Memoized and self-contained: its state never re-renders the parent form,
 * and it never touches the form's PATCH payload (changes save on their own).
 */
export const RecipeStoryMediaEditor = memo(function RecipeStoryMediaEditor({
  recipeId,
  initialMedia,
  stagedRef,
}: Props) {
  if (!recipeId && stagedRef) return <StagedStoryMediaEditor stagedRef={stagedRef} />;
  return <SavedStoryMediaEditor recipeId={recipeId} initialMedia={initialMedia} />;
});

/** Edit mode: every change saves immediately through the story-media API. */
function SavedStoryMediaEditor({
  recipeId,
  initialMedia,
}: Pick<Props, "recipeId" | "initialMedia">) {
  const [items, setItems] = useState<StoryMediaItem[]>(() =>
    parseStoryMedia(initialMedia ?? [])
  );
  const [ytUrl, setYtUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const applyResponse = useCallback(async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : fallback);
      return false;
    }
    setItems(parseStoryMedia(data.items));
    return true;
  }, []);

  const uploadFile = useCallback(
    async (file: File | null) => {
      setError(null);
      if (!file || !recipeId) return;
      const mime = (file.type || "").toLowerCase();
      if (mime && !ALLOWED.includes(mime)) {
        setError("Image must be JPEG, PNG, WebP, or GIF.");
        return;
      }
      if (file.size <= 0) return setError("Empty image file.");
      if (file.size > MAX_BYTES) return setError("Image must be 5MB or smaller.");
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/recipes/${recipeId}/story-media`, {
          method: "POST",
          body: fd,
        });
        await applyResponse(res, "Upload failed");
      } catch {
        setError("Upload failed");
      } finally {
        setBusy(false);
        if (cameraRef.current) cameraRef.current.value = "";
        if (galleryRef.current) galleryRef.current.value = "";
      }
    },
    [recipeId, applyResponse]
  );

  const addYoutube = useCallback(async () => {
    setError(null);
    if (!recipeId) return;
    if (!parseYoutubeVideoId(ytUrl)) {
      setError("Enter a valid YouTube link (youtube.com, youtu.be, or Shorts).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/story-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: ytUrl.trim() }),
      });
      if (await applyResponse(res, "Could not add video")) setYtUrl("");
    } catch {
      setError("Could not add video");
    } finally {
      setBusy(false);
    }
  }, [recipeId, ytUrl, applyResponse]);

  const remove = useCallback(
    async (itemId: string) => {
      setError(null);
      if (!recipeId) return;
      setBusy(true);
      try {
        const res = await fetch(
          `/api/recipes/${recipeId}/story-media?itemId=${encodeURIComponent(itemId)}`,
          { method: "DELETE" }
        );
        await applyResponse(res, "Could not remove");
      } catch {
        setError("Could not remove");
      } finally {
        setBusy(false);
      }
    },
    [recipeId, applyResponse]
  );

  if (!recipeId) {
    return (
      <p className="mt-2 text-xs text-sage-500">
        Save the recipe first, then use Edit to add story photos or YouTube videos.
      </p>
    );
  }

  const full = items.length >= STORY_MEDIA_MAX_ITEMS;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-cream-200 bg-cream-50/60 p-3">
      <div>
        <p className="text-sm font-semibold text-sage-800">Story photos &amp; videos</p>
        <p className="text-xs text-sage-500">
          Shown inside the story section. Changes save immediately.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((m) => (
            <li
              key={m.id}
              className="relative overflow-hidden rounded-lg border border-cream-200 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.kind === "image" ? m.url : youtubeThumbnailUrl(m.videoId)}
                alt={m.kind === "image" ? "Story photo" : "YouTube video"}
                className="aspect-video w-full object-cover"
                loading="lazy"
              />
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                {m.kind === "youtube" ? (
                  <a
                    href={youtubeWatchUrl(m.videoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-ember-700 underline"
                  >
                    ▶ YouTube
                  </a>
                ) : (
                  <span className="text-sage-600">Photo</span>
                )}
                <button
                  type="button"
                  className="font-medium text-red-600 hover:underline disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void remove(m.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy || full}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? "Working…" : "Take photo"}
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy || full}
          onClick={() => galleryRef.current?.click()}
        >
          Upload photo
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          inputMode="url"
          className="input flex-1"
          placeholder="Paste a YouTube link (youtube.com, youtu.be, Shorts)"
          value={ytUrl}
          disabled={busy || full}
          onChange={(e) => setYtUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addYoutube();
            }
          }}
        />
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy || full || !ytUrl.trim()}
          onClick={() => void addYoutube()}
        >
          Add video
        </button>
      </div>
      {full && (
        <p className="text-xs text-sage-500">
          Limit reached ({STORY_MEDIA_MAX_ITEMS}). Remove one to add more.
        </p>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void uploadFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void uploadFile(e.target.files?.[0] ?? null)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Create mode: photos + YouTube links are staged locally (nothing is uploaded
 * until the recipe exists). Items are mirrored into `stagedRef` so RecipeForm
 * can upload them after POST /api/recipes without re-rendering this editor.
 */
function StagedStoryMediaEditor({
  stagedRef,
}: {
  stagedRef: MutableRefObject<StagedStoryMediaItem[]>;
}) {
  const [items, setItems] = useState<StagedStoryMediaItem[]>([]);
  const [ytUrl, setYtUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<StagedStoryMediaItem[]>(items);

  // Single write path: local state + the ref RecipeForm reads on submit (synchronously,
  // so a submit right after adding an item can never miss it).
  const commit = useCallback(
    (next: StagedStoryMediaItem[]) => {
      itemsRef.current = next;
      stagedRef.current = next;
      setItems(next);
    },
    [stagedRef]
  );

  // Start clean for this form instance.
  useEffect(() => {
    stagedRef.current = itemsRef.current;
  }, [stagedRef]);

  // Release local previews when the form goes away (after save/navigation).
  useEffect(
    () => () => {
      for (const m of itemsRef.current) {
        if (m.kind === "image") URL.revokeObjectURL(m.previewUrl);
      }
    },
    []
  );

  const addFile = useCallback((file: File | null) => {
    setError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const res = stageImage(itemsRef.current, file, previewUrl);
    if (!res.ok) {
      URL.revokeObjectURL(previewUrl);
      setError(res.error);
      return;
    }
    commit(res.items);
  }, [commit]);

  const addYoutube = useCallback(() => {
    setError(null);
    const res = stageYoutube(itemsRef.current, ytUrl);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    commit(res.items);
    setYtUrl("");
  }, [ytUrl, commit]);

  const remove = useCallback((itemId: string) => {
    setError(null);
    const gone = itemsRef.current.find((m) => m.id === itemId);
    if (gone?.kind === "image") URL.revokeObjectURL(gone.previewUrl);
    commit(itemsRef.current.filter((m) => m.id !== itemId));
  }, [commit]);

  const full = items.length >= STORY_MEDIA_MAX_ITEMS;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-cream-200 bg-cream-50/60 p-3">
      <div>
        <p className="text-sm font-semibold text-sage-800">Story photos &amp; videos</p>
        <p className="text-xs text-sage-500">
          Added to the story section when you save the recipe.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((m) => (
            <li
              key={m.id}
              className="relative overflow-hidden rounded-lg border border-cream-200 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.kind === "image" ? m.previewUrl : youtubeThumbnailUrl(m.videoId)}
                alt={m.kind === "image" ? "Story photo (not saved yet)" : "YouTube video"}
                className="aspect-video w-full object-cover"
              />
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                {m.kind === "youtube" ? (
                  <a
                    href={youtubeWatchUrl(m.videoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-ember-700 underline"
                  >
                    ▶ YouTube
                  </a>
                ) : (
                  <span className="truncate text-sage-600" title={m.file.name}>
                    Photo
                  </span>
                )}
                <button
                  type="button"
                  className="font-medium text-red-600 hover:underline"
                  onClick={() => remove(m.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={full}
          onClick={() => cameraRef.current?.click()}
        >
          Take photo
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={full}
          onClick={() => galleryRef.current?.click()}
        >
          Upload photo
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          inputMode="url"
          className="input flex-1"
          placeholder="Paste a YouTube link (youtube.com, youtu.be, Shorts)"
          value={ytUrl}
          disabled={full}
          onChange={(e) => setYtUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addYoutube();
            }
          }}
        />
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={full || !ytUrl.trim()}
          onClick={addYoutube}
        >
          Add video
        </button>
      </div>
      {full && (
        <p className="text-xs text-sage-500">
          Limit reached ({STORY_MEDIA_MAX_ITEMS}). Remove one to add more.
        </p>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => addFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => addFile(e.target.files?.[0] ?? null)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
