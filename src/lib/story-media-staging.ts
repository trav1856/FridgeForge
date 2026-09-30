// Client-safe helpers for staging recipe story media (photos + YouTube links)
// on the create form, before the recipe exists. After the recipe is created the
// staged items are uploaded, in order, through the same owner-only endpoint the
// edit page uses: POST /api/recipes/[id]/story-media. No fs imports here.

import {
  STORY_MEDIA_MAX_ITEMS,
  newStoryMediaItemId,
  parseYoutubeVideoId,
} from "@/lib/origin-story-media";

/** Keep in sync with RECIPE_USER_IMAGE_MAX_BYTES / RECIPE_USER_IMAGE_MIME in recipe-user-images.ts */
export const STAGED_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const STAGED_IMAGE_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export type StagedStoryImage = {
  id: string;
  kind: "image";
  file: File;
  /** Object URL for the local preview (revoked by the editor). */
  previewUrl: string;
};
export type StagedStoryYoutube = {
  id: string;
  kind: "youtube";
  videoId: string;
  /** Link as the user typed it (sent to the API, which re-validates). */
  url: string;
};
export type StagedStoryMediaItem = StagedStoryImage | StagedStoryYoutube;

export type StageResult =
  | { ok: true; items: StagedStoryMediaItem[] }
  | { ok: false; error: string };

const LIMIT_ERROR = `Up to ${STORY_MEDIA_MAX_ITEMS} photos/videos per story.`;

/** Pure: validate a picked photo (same rules as the server). Returns an error or null. */
export function validateStagedImage(file: {
  type?: string | null;
  size: number;
}): string | null {
  const mime = (file.type || "").toLowerCase().trim();
  if (!STAGED_IMAGE_MIME.includes(mime)) {
    return "Image must be JPEG, PNG, WebP, or GIF.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return "Empty image file.";
  if (file.size > STAGED_IMAGE_MAX_BYTES) return "Image must be 5MB or smaller.";
  return null;
}

/** Pure: append a staged YouTube link (validated, deduped by video id, capped). */
export function stageYoutube(
  items: StagedStoryMediaItem[],
  url: string,
  id: string = newStoryMediaItemId()
): StageResult {
  const videoId = parseYoutubeVideoId(url);
  if (!videoId) {
    return {
      ok: false,
      error: "Enter a valid YouTube link (youtube.com, youtu.be, or Shorts).",
    };
  }
  if (items.some((m) => m.kind === "youtube" && m.videoId === videoId)) {
    return { ok: false, error: "That video is already in the story." };
  }
  if (items.length >= STORY_MEDIA_MAX_ITEMS) return { ok: false, error: LIMIT_ERROR };
  return {
    ok: true,
    items: [...items, { id, kind: "youtube", videoId, url: url.trim() }],
  };
}

/** Pure: append a staged photo (validated, capped). previewUrl is supplied by the caller. */
export function stageImage(
  items: StagedStoryMediaItem[],
  file: File,
  previewUrl: string,
  id: string = newStoryMediaItemId()
): StageResult {
  const invalid = validateStagedImage(file);
  if (invalid) return { ok: false, error: invalid };
  if (items.length >= STORY_MEDIA_MAX_ITEMS) return { ok: false, error: LIMIT_ERROR };
  return { ok: true, items: [...items, { id, kind: "image", file, previewUrl }] };
}

export function stagedItemLabel(item: StagedStoryMediaItem): string {
  return item.kind === "image"
    ? `photo “${item.file.name || "untitled"}”`
    : `YouTube video ${item.videoId}`;
}

export type StagedUploadFailure = {
  item: StagedStoryMediaItem;
  label: string;
  error: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Upload staged items to a freshly created recipe, sequentially so the story
 * keeps the order the user chose. Never throws: every item is attempted and each
 * failure is reported (with the server's error text when available).
 */
export async function uploadStagedStoryMedia(
  recipeId: string,
  items: StagedStoryMediaItem[],
  fetchImpl: FetchLike = (input, init) => fetch(input, init)
): Promise<{ uploaded: number; failures: StagedUploadFailure[] }> {
  const failures: StagedUploadFailure[] = [];
  let uploaded = 0;
  const endpoint = `/api/recipes/${encodeURIComponent(recipeId)}/story-media`;
  for (const item of items) {
    const label = stagedItemLabel(item);
    try {
      let init: RequestInit;
      if (item.kind === "image") {
        const fd = new FormData();
        fd.append("file", item.file);
        init = { method: "POST", body: fd };
      } else {
        init = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeUrl: item.url }),
        };
      }
      const res = await fetchImpl(endpoint, init);
      if (res.ok) {
        uploaded += 1;
        continue;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      failures.push({
        item,
        label,
        error:
          typeof data.error === "string" && data.error
            ? data.error
            : `Upload failed (HTTP ${res.status})`,
      });
    } catch {
      failures.push({ item, label, error: "Network error" });
    }
  }
  return { uploaded, failures };
}

/** Human summary of failed uploads for the form's error line. */
export function describeStagedFailures(failures: StagedUploadFailure[]): string {
  if (!failures.length) return "";
  const n = failures.length;
  const list = failures.map((f) => `${f.label}: ${f.error}`).join("; ");
  return `${n} story item${n === 1 ? "" : "s"} could not be added (${list}). Open Edit on the recipe to add ${n === 1 ? "it" : "them"} again.`;
}
