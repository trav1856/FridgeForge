// Pure, client-safe helpers for recipe story media (photos + YouTube links).
// Stored on Recipe.originStoryMedia as a JSON array string. No fs imports here.

export type StoryMediaImage = { id: string; kind: "image"; url: string };
export type StoryMediaYoutube = { id: string; kind: "youtube"; videoId: string };
export type StoryMediaItem = StoryMediaImage | StoryMediaYoutube;

/** Max items (photos + videos) per recipe story. */
export const STORY_MEDIA_MAX_ITEMS = 12;

const YT_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const MANAGED_IMAGE_RE = /^\/recipe-images\/user\/[A-Za-z0-9._-]+$/;
const ITEM_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * Parse a YouTube URL (youtube.com/watch?v=, youtu.be/, /shorts/, /embed/,
 * /live/, /v/) or a bare 11-char id into a video id. Returns null if invalid.
 */
export function parseYoutubeVideoId(input: string | null | undefined): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (YT_VIDEO_ID_RE.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === "youtu.be" || host === "www.youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (YT_HOSTS.has(host)) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") {
      candidate = url.searchParams.get("v");
    } else if (
      parts.length >= 2 &&
      ["shorts", "embed", "live", "v"].includes(parts[0]!)
    ) {
      candidate = parts[1]!;
    }
  } else {
    return null;
  }
  return candidate && YT_VIDEO_ID_RE.test(candidate) ? candidate : null;
}

export function youtubeEmbedUrl(videoId: string, autoplay = false): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}${autoplay ? "?autoplay=1" : ""}`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function isManagedStoryImagePath(url: string | null | undefined): boolean {
  return Boolean(url && MANAGED_IMAGE_RE.test(url));
}

/** Short random id for a media item (client or server). */
export function newStoryMediaItemId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${rand}`.slice(0, 20);
}

/** Validate one untrusted item; returns a clean copy or null. */
export function normalizeStoryMediaItem(value: unknown): StoryMediaItem | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const id = typeof v.id === "string" && ITEM_ID_RE.test(v.id) ? v.id : null;
  if (!id) return null;
  if (v.kind === "image" && typeof v.url === "string" && isManagedStoryImagePath(v.url)) {
    return { id, kind: "image", url: v.url };
  }
  if (
    v.kind === "youtube" &&
    typeof v.videoId === "string" &&
    YT_VIDEO_ID_RE.test(v.videoId)
  ) {
    return { id, kind: "youtube", videoId: v.videoId };
  }
  return null;
}

/** Parse the DB JSON string (or an already-parsed array) into clean items. */
export function parseStoryMedia(value: unknown): StoryMediaItem[] {
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: StoryMediaItem[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const item = normalizeStoryMediaItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= STORY_MEDIA_MAX_ITEMS) break;
  }
  return out;
}

export function stringifyStoryMedia(items: StoryMediaItem[]): string {
  return JSON.stringify(parseStoryMedia(items));
}

export type StoryMediaAddResult =
  | { ok: true; items: StoryMediaItem[]; item: StoryMediaItem }
  | { ok: false; error: string };

/** Pure: append a YouTube link (deduped by video id). */
export function addYoutubeToStoryMedia(
  items: StoryMediaItem[],
  url: string,
  id: string = newStoryMediaItemId()
): StoryMediaAddResult {
  const videoId = parseYoutubeVideoId(url);
  if (!videoId) {
    return { ok: false, error: "Enter a valid YouTube link (youtube.com, youtu.be, or Shorts)." };
  }
  const dupe = items.find((m) => m.kind === "youtube" && m.videoId === videoId);
  if (dupe) return { ok: false, error: "That video is already in the story." };
  if (items.length >= STORY_MEDIA_MAX_ITEMS) {
    return { ok: false, error: `Up to ${STORY_MEDIA_MAX_ITEMS} photos/videos per story.` };
  }
  const item: StoryMediaYoutube = { id, kind: "youtube", videoId };
  return { ok: true, items: [...items, item], item };
}

/** Pure: remove an item by id. Returns next list and the removed item (if any). */
export function removeStoryMediaItem(
  items: StoryMediaItem[],
  itemId: string
): { items: StoryMediaItem[]; removed: StoryMediaItem | null } {
  const removed = items.find((m) => m.id === itemId) ?? null;
  return { items: items.filter((m) => m.id !== itemId), removed };
}
