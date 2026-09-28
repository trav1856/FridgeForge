import { describe, expect, it } from "vitest";
import {
  STORY_MEDIA_MAX_ITEMS,
  addYoutubeToStoryMedia,
  parseStoryMedia,
  parseYoutubeVideoId,
  removeStoryMediaItem,
  stringifyStoryMedia,
  type StoryMediaItem,
} from "@/lib/origin-story-media";

const ID = "dQw4w9WgXcQ";

describe("parseYoutubeVideoId", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?feature=share&v=${ID}&t=10`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `youtube.com/watch?v=${ID}`,
    ID,
  ])("parses %s", (url) => {
    expect(parseYoutubeVideoId(url)).toBe(ID);
  });

  it.each([
    "",
    "not a url",
    "https://vimeo.com/12345",
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UC123",
    `javascript:alert(1)//youtu.be/${ID}`,
  ])("rejects %s", (url) => {
    expect(parseYoutubeVideoId(url)).toBeNull();
  });
});

describe("parseStoryMedia", () => {
  it("keeps valid items and drops invalid/unsafe ones", () => {
    const raw = JSON.stringify([
      { id: "img1abc", kind: "image", url: "/recipe-images/user/a-b.jpg" },
      { id: "yt1abcd", kind: "youtube", videoId: ID },
      { id: "bad1abc", kind: "image", url: "https://evil.com/x.jpg" },
      { id: "bad2abc", kind: "image", url: "/recipe-images/user/../../x" },
      { id: "bad3abc", kind: "youtube", videoId: "<script>" },
      { id: "img1abc", kind: "image", url: "/recipe-images/user/dupe.jpg" },
      "junk",
    ]);
    const items = parseStoryMedia(raw);
    expect(items.map((i) => i.id)).toEqual(["img1abc", "yt1abcd"]);
  });

  it("handles empty/garbage", () => {
    expect(parseStoryMedia(null)).toEqual([]);
    expect(parseStoryMedia("[]")).toEqual([]);
    expect(parseStoryMedia("{not json")).toEqual([]);
    expect(stringifyStoryMedia([])).toBe("[]");
  });
});

describe("add/remove", () => {
  it("adds youtube, dedupes, caps, removes", () => {
    let items: StoryMediaItem[] = [];
    const a = addYoutubeToStoryMedia(items, `https://youtu.be/${ID}`, "item0001");
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    items = a.items;
    expect(items[0]).toEqual({ id: "item0001", kind: "youtube", videoId: ID });
    expect(addYoutubeToStoryMedia(items, `https://www.youtube.com/watch?v=${ID}`).ok).toBe(false);
    expect(addYoutubeToStoryMedia(items, "https://vimeo.com/1").ok).toBe(false);

    const full: StoryMediaItem[] = Array.from({ length: STORY_MEDIA_MAX_ITEMS }, (_, i) => ({
      id: `img${i}xxxx`,
      kind: "image" as const,
      url: `/recipe-images/user/${i}.jpg`,
    }));
    expect(addYoutubeToStoryMedia(full, `https://youtu.be/${ID}`).ok).toBe(false);

    const r = removeStoryMediaItem(items, "item0001");
    expect(r.items).toEqual([]);
    expect(r.removed?.id).toBe("item0001");
    expect(removeStoryMediaItem(items, "nope").removed).toBeNull();
  });
});
