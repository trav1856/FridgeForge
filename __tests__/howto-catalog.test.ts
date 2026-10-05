import { describe, expect, it } from "vitest";
import { HOWTO_CATALOG } from "@/lib/howto-catalog";
import { buildStruggleSeedRows } from "@/lib/struggle-resources";

describe("howto catalog (seed source of truth)", () => {
  it("has unique stable slugs for badges, courses, and lessons per course", () => {
    const badgeSlugs = HOWTO_CATALOG.map((e) => e.badge.slug);
    const courseSlugs = HOWTO_CATALOG.map((e) => e.course.slug);
    expect(new Set(badgeSlugs).size).toBe(badgeSlugs.length);
    expect(new Set(courseSlugs).size).toBe(courseSlugs.length);
    for (const e of HOWTO_CATALOG) {
      const ls = e.lessons.map((l) => l.slug);
      expect(new Set(ls).size).toBe(ls.length);
      expect(e.lessons.length).toBeGreaterThan(0);
      for (const l of e.lessons) expect(l.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("ships the starter courses in sort order", () => {
    expect(courseSlugsSorted()).toEqual([
      "boil-water",
      "knife-safety",
      "scramble-eggs",
      "cook-rice",
      "taste-as-you-go",
    ]);
  });
});

describe("struggle seed rows", () => {
  it("has unique slugs and both kinds", () => {
    const rows = buildStruggleSeedRows();
    const slugs = rows.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(rows.some((r) => r.kind === "tip")).toBe(true);
    expect(rows.some((r) => r.kind === "kids_meal")).toBe(true);
  });
});

function courseSlugsSorted() {
  return [...HOWTO_CATALOG]
    .sort((a, b) => a.course.sortOrder - b.course.sortOrder)
    .map((e) => e.course.slug);
}
