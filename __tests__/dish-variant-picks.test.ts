import { describe, expect, it } from "vitest";
import {
  compareOldest,
  compareTopRated,
  pickDishVariantHighlights,
  type DishVariantCandidate,
} from "@/lib/dish-variant-picks";

const v = (
  id: string,
  opts: Partial<DishVariantCandidate> & { title?: string } = {}
): DishVariantCandidate => ({
  id,
  title: opts.title ?? id,
  imageUrl: opts.imageUrl ?? null,
  createdAt: opts.createdAt ?? "2026-01-01T00:00:00.000Z",
  averageStars: opts.averageStars ?? null,
  reviewCount: opts.reviewCount ?? 0,
});

describe("compareTopRated", () => {
  it("prefers higher average stars", () => {
    const a = v("a", { averageStars: 4.5, reviewCount: 2 });
    const b = v("b", { averageStars: 3.0, reviewCount: 10 });
    expect(compareTopRated(a, b)).toBeLessThan(0);
  });

  it("tie-breaks on review count then recency", () => {
    const older = v("old", {
      averageStars: 4,
      reviewCount: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const moreReviews = v("more", {
      averageStars: 4,
      reviewCount: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(compareTopRated(moreReviews, older)).toBeLessThan(0);

    const newer = v("new", {
      averageStars: 4,
      reviewCount: 5,
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    expect(compareTopRated(newer, moreReviews)).toBeLessThan(0);
  });

  it("ranks unrated below rated", () => {
    const rated = v("r", { averageStars: 2, reviewCount: 1 });
    const unrated = v("u");
    expect(compareTopRated(rated, unrated)).toBeLessThan(0);
  });
});

describe("compareOldest", () => {
  it("orders by createdAt ascending", () => {
    const a = v("a", { createdAt: "2025-01-01T00:00:00.000Z" });
    const b = v("b", { createdAt: "2026-01-01T00:00:00.000Z" });
    expect(compareOldest(a, b)).toBeLessThan(0);
  });
});

describe("pickDishVariantHighlights", () => {
  const uncle = v("uncle", {
    title: "Uncle Roger Fried Rice",
    averageStars: 4.8,
    reviewCount: 12,
    createdAt: "2026-03-01T00:00:00.000Z",
  });
  const classic = v("classic", {
    title: "China Guy Fried Rice",
    averageStars: 4.2,
    reviewCount: 40,
    createdAt: "2024-01-01T00:00:00.000Z",
  });
  const mine = v("mine", {
    title: "My Fried Rice",
    averageStars: 3.5,
    reviewCount: 2,
    createdAt: "2026-06-01T00:00:00.000Z",
  });
  const extra = v("extra", {
    title: "Extra Variant",
    averageStars: 3.0,
    reviewCount: 1,
    createdAt: "2026-05-01T00:00:00.000Z",
  });

  it("returns empty for empty input", () => {
    expect(pickDishVariantHighlights([])).toEqual({
      featured: [],
      rest: [],
    });
  });

  it("picks top rated, oldest, and surprise as distinct recipes", () => {
    const picks = pickDishVariantHighlights([uncle, classic, mine, extra], {
      rng: () => 0,
    });
    expect(picks.featured.map((f) => f.role)).toEqual([
      "top-rated",
      "oldest",
      "surprise",
    ]);
    expect(picks.featured.map((f) => f.label)).toEqual([
      "Top rated",
      "Oldest",
      "Surprise",
    ]);
    expect(picks.featured[0]!.recipe.id).toBe("uncle");
    expect(picks.featured[1]!.recipe.id).toBe("classic");
    expect(picks.featured[2]!.recipe.id).toBe("mine"); // rng 0 → first remaining after sort filter
    expect(picks.rest.map((r) => r.id)).toEqual(["extra"]);
  });

  it("does not invent fillers when fewer than three variants", () => {
    const one = pickDishVariantHighlights([uncle]);
    expect(one.featured).toHaveLength(1);
    expect(one.featured[0]!.role).toBe("top-rated");
    expect(one.rest).toEqual([]);

    const two = pickDishVariantHighlights([uncle, classic], { rng: () => 0 });
    expect(two.featured).toHaveLength(2);
    expect(two.featured.map((f) => f.role)).toEqual(["top-rated", "oldest"]);
    expect(two.rest).toEqual([]);
  });

  it("puts non-featured variants in rest sorted by title", () => {
    const picks = pickDishVariantHighlights([uncle, classic, mine, extra], {
      rng: () => 0.99, // last remaining
    });
    expect(picks.featured).toHaveLength(3);
    expect(picks.rest).toHaveLength(1);
    // remaining after uncle+classic+surprise(extra) → mine
    expect(picks.featured[2]!.recipe.id).toBe("extra");
    expect(picks.rest[0]!.id).toBe("mine");
  });

  it("avoids duplicating top-rated as oldest when another exists", () => {
    // classic is oldest and also would lose on rating to uncle
    const picks = pickDishVariantHighlights([uncle, classic], { rng: () => 0 });
    expect(new Set(picks.featured.map((f) => f.recipe.id)).size).toBe(2);
  });
});
