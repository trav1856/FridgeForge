import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { recipe: { findMany } } }));

import {
  managedImageUrlsForRecipe,
  unreferencedManagedImageUrls,
} from "@/lib/recipe-user-images";
import { deleteOrphanedRecipeImages } from "@/lib/recipe-image-cleanup";

const U = (f: string) => `/recipe-images/user/${f}`;
const media = (...items: object[]) => JSON.stringify(items);

describe("managedImageUrlsForRecipe", () => {
  it("collects managed main photo + story photos, deduped, ignoring others", () => {
    expect(
      managedImageUrlsForRecipe({
        imageUrl: U("main.jpg"),
        originStoryMedia: media(
          { id: "aaaa1", kind: "image", url: U("s1.png") },
          { id: "aaaa2", kind: "youtube", videoId: "dQw4w9WgXcQ" },
          { id: "aaaa3", kind: "image", url: U("main.jpg") },
          { id: "aaaa4", kind: "image", url: "https://evil.example/x.png" },
          { id: "aaaa5", kind: "image", url: "/recipe-images/user/../../etc/passwd" }
        ),
      })
    ).toEqual([U("main.jpg"), U("s1.png")]);
    expect(managedImageUrlsForRecipe({ imageUrl: "/recipe-images/banana-bread.jpg" })).toEqual([]);
    expect(managedImageUrlsForRecipe({ imageUrl: "https://x/y.jpg", originStoryMedia: "not json" })).toEqual([]);
  });
});

describe("unreferencedManagedImageUrls", () => {
  const candidates = [U("a.jpg"), U("b.png"), U("c.webp"), U("d.gif"), U("e.jpg")];
  it("keeps any file another recipe still references (main or story, any form)", () => {
    const others = [
      { imageUrl: U("a.jpg"), originStoryMedia: "[]" }, // shared main photo
      { imageUrl: null, originStoryMedia: media({ id: "x1234", kind: "image", url: U("b.png") }) }, // story
      { imageUrl: `https://fridgeforge.example${U("c.webp")}?v=2`, originStoryMedia: "[]" }, // absolute URL
      { imageUrl: null, originStoryMedia: '[{"id":"y1234","kind":"image","url":"\\/recipe-images\\/user\\/d.gif"}]' }, // escaped JSON
      { imageUrl: U("e.jpg.bak"), originStoryMedia: "[]" }, // different file, same prefix
    ];
    expect(unreferencedManagedImageUrls(candidates, others)).toEqual([U("e.jpg")]);
  });
  it("returns all candidates when nothing else references them; never non-managed paths", () => {
    expect(unreferencedManagedImageUrls([U("a.jpg"), "/recipe-images/x.jpg"], [])).toEqual([U("a.jpg")]);
  });
});

describe("deleteOrphanedRecipeImages (real files in a temp public dir)", () => {
  let tmp: string;
  let dir: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "ff-img-"));
    dir = path.join(tmp, "public", "recipe-images", "user");
    await mkdir(dir, { recursive: true });
    for (const f of ["main.jpg", "story1.png", "shared.png", "other.jpg"]) {
      await writeFile(path.join(dir, f), "x");
    }
    vi.spyOn(process, "cwd").mockReturnValue(tmp);
    findMany.mockReset();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmp, { recursive: true, force: true });
  });

  it("unlinks only the deleted recipe's files that no other recipe uses", async () => {
    findMany.mockResolvedValue([
      { imageUrl: U("other.jpg"), originStoryMedia: media({ id: "z1234", kind: "image", url: U("shared.png") }) },
    ]);
    const removed = await deleteOrphanedRecipeImages({
      id: "gone",
      imageUrl: U("main.jpg"),
      originStoryMedia: media(
        { id: "s1234", kind: "image", url: U("story1.png") },
        { id: "s5678", kind: "image", url: U("shared.png") },
        { id: "s9999", kind: "youtube", videoId: "dQw4w9WgXcQ" }
      ),
    });
    expect(removed.sort()).toEqual([U("main.jpg"), U("story1.png")]);
    expect((await readdir(dir)).sort()).toEqual(["other.jpg", "shared.png"]);
    const where = findMany.mock.calls[0]![0].where;
    expect(where.id).toEqual({ not: "gone" });
  });

  it("does nothing (no query) when the recipe has no uploaded files", async () => {
    expect(await deleteOrphanedRecipeImages({ id: "r", imageUrl: "/recipe-images/pancakes.jpg", originStoryMedia: "[]" })).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect((await readdir(dir)).length).toBe(4);
  });

  it("never throws and deletes nothing if the reference query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockRejectedValue(new Error("db down"));
    expect(await deleteOrphanedRecipeImages({ id: "r", imageUrl: U("main.jpg") })).toEqual([]);
    expect((await readdir(dir)).length).toBe(4);
  });
});
