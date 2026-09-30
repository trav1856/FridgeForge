import { describe, expect, it, vi } from "vitest";
import { STORY_MEDIA_MAX_ITEMS } from "@/lib/origin-story-media";
import {
  STAGED_IMAGE_MAX_BYTES,
  describeStagedFailures,
  stageImage,
  stageYoutube,
  uploadStagedStoryMedia,
  validateStagedImage,
  type StagedStoryMediaItem,
} from "@/lib/story-media-staging";

const VID = "dQw4w9WgXcQ";
const png = (name = "a.png", size = 10) =>
  new File([new Uint8Array(size)], name, { type: "image/png" });

describe("validateStagedImage", () => {
  it("accepts supported types under the limit", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(validateStagedImage({ type, size: 100 })).toBeNull();
    }
  });
  it("rejects bad type, empty and oversize", () => {
    expect(validateStagedImage({ type: "application/pdf", size: 10 })).toMatch(/JPEG/);
    expect(validateStagedImage({ type: "", size: 10 })).toMatch(/JPEG/);
    expect(validateStagedImage({ type: "image/png", size: 0 })).toMatch(/Empty/);
    expect(
      validateStagedImage({ type: "image/png", size: STAGED_IMAGE_MAX_BYTES + 1 })
    ).toMatch(/5MB/);
  });
});

describe("stageYoutube / stageImage", () => {
  it("stages a valid link, keeps the typed url, rejects invalid + duplicate", () => {
    const r = stageYoutube([], ` https://youtu.be/${VID}?si=x `, "id1");
    expect(r).toEqual({
      ok: true,
      items: [{ id: "id1", kind: "youtube", videoId: VID, url: `https://youtu.be/${VID}?si=x` }],
    });
    if (!r.ok) throw new Error();
    const dup = stageYoutube(r.items, `https://www.youtube.com/watch?v=${VID}`);
    expect(dup.ok).toBe(false);
    expect(stageYoutube([], "https://vimeo.com/123").ok).toBe(false);
  });

  it("stages a photo and enforces validation", () => {
    const f = png();
    const r = stageImage([], f, "blob:preview", "p1");
    expect(r).toEqual({
      ok: true,
      items: [{ id: "p1", kind: "image", file: f, previewUrl: "blob:preview" }],
    });
    const bad = new File(["x"], "a.txt", { type: "text/plain" });
    expect(stageImage([], bad, "blob:x").ok).toBe(false);
  });

  it("caps staged items at the story limit", () => {
    const full: StagedStoryMediaItem[] = Array.from({ length: STORY_MEDIA_MAX_ITEMS }, (_, i) => ({
      id: `i${i}`,
      kind: "image",
      file: png(),
      previewUrl: "blob:x",
    }));
    const a = stageImage(full, png(), "blob:y");
    const b = stageYoutube(full, VID);
    expect(a.ok || b.ok).toBe(false);
    if (!a.ok) expect(a.error).toMatch(String(STORY_MEDIA_MAX_ITEMS));
  });
});

describe("uploadStagedStoryMedia", () => {
  const items: StagedStoryMediaItem[] = [
    { id: "a", kind: "image", file: png("one.png"), previewUrl: "blob:1" },
    { id: "b", kind: "youtube", videoId: VID, url: `https://youtu.be/${VID}` },
    { id: "c", kind: "image", file: png("two.png"), previewUrl: "blob:2" },
  ];

  it("uploads in order with the same requests the edit page makes", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const res = await uploadStagedStoryMedia("rec1", items, fetchImpl);
    expect(res).toEqual({ uploaded: 3, failures: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    for (const [url, init] of calls) {
      expect(url).toBe("/api/recipes/rec1/story-media");
      expect(init.method).toBe("POST");
    }
    const first = calls[0]![1].body as FormData;
    expect(first).toBeInstanceOf(FormData);
    expect((first.get("file") as File).name).toBe("one.png");
    expect(calls[1]![1].headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(calls[1]![1].body))).toEqual({
      youtubeUrl: `https://youtu.be/${VID}`,
    });
    expect(((calls[2]![1].body as FormData).get("file") as File).name).toBe("two.png");
  });

  it("attempts every item and reports each failure (server text or network)", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) return new Response(JSON.stringify({ error: "Image must be 5MB or smaller." }), { status: 400 });
      if (n === 2) throw new TypeError("offline");
      return new Response("not json", { status: 500 });
    });
    const res = await uploadStagedStoryMedia("rec1", items, fetchImpl);
    expect(res.uploaded).toBe(0);
    expect(res.failures.map((f) => [f.item.id, f.error])).toEqual([
      ["a", "Image must be 5MB or smaller."],
      ["b", "Network error"],
      ["c", "Upload failed (HTTP 500)"],
    ]);
    const msg = describeStagedFailures(res.failures);
    expect(msg).toMatch(/^3 story items could not be added/);
    expect(msg).toContain("photo “one.png”: Image must be 5MB or smaller.");
    expect(msg).toContain(`YouTube video ${VID}: Network error`);
  });

  it("no items → no requests", async () => {
    const fetchImpl = vi.fn();
    expect(await uploadStagedStoryMedia("r", [], fetchImpl)).toEqual({ uploaded: 0, failures: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(describeStagedFailures([])).toBe("");
  });
});
