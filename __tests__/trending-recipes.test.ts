import { describe, expect, it } from "vitest";
import {
  isTrendingEligible,
  pickTrendingRecipes,
} from "@/lib/trending-recipes";

describe("isTrendingEligible", () => {
  it("allows shared catalog", () => {
    expect(isTrendingEligible({ householdId: null })).toBe(true);
  });

  it("allows public household recipes", () => {
    expect(
      isTrendingEligible({ householdId: "hh1", visibility: "public" })
    ).toBe(true);
  });

  it("blocks private household recipes", () => {
    expect(
      isTrendingEligible({ householdId: "hh1", visibility: "household" })
    ).toBe(false);
  });
});

describe("pickTrendingRecipes", () => {
  const r = (id: string) => ({ id, title: id });

  it("prefers week favorites and shows real counts", () => {
    const picks = pickTrendingRecipes(
      [{ recipe: r("a"), favoriteCount: 5 }],
      [{ recipe: r("b"), favoriteCount: 99 }],
      [r("c"), r("d")],
      6,
      () => 0
    );
    expect(picks).toHaveLength(1);
    expect(picks[0]!.source).toBe("week");
    expect(picks[0]!.favoriteCount).toBe(5);
  });

  it("falls back to all-time when week empty", () => {
    const picks = pickTrendingRecipes(
      [],
      [{ recipe: r("b"), favoriteCount: 3 }],
      [r("c")],
      6
    );
    expect(picks[0]!.source).toBe("all_time");
    expect(picks[0]!.favoriteCount).toBe(3);
  });

  it("falls back to shuffled sample without fake counts", () => {
    const picks = pickTrendingRecipes([], [], [r("c"), r("d"), r("e")], 2, () => 0);
    expect(picks).toHaveLength(2);
    expect(picks.every((p) => p.source === "fallback")).toBe(true);
    expect(picks.every((p) => p.favoriteCount === null)).toBe(true);
  });
});
