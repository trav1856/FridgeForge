import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import {
  costTierFilterHref,
  courseFilterHref,
  cuisineFilterHref,
  meatTypeFilterHref,
  dietaryFilterHref,
  foodCategoryFilterHref,
  originFilterHref,
  struggleFilterHref,
} from "@/lib/recipe-filter-hrefs";

function source(rel: string): string {
  return readFileSync(resolve(__dirname, "..", rel), "utf8");
}

describe("recipe filter hrefs", () => {
  it("builds list URLs for cuisine/course/food/origin/cost/dietary", () => {
    expect(cuisineFilterHref("American")).toBe("/recipes?cuisine=American");
    expect(courseFilterHref("dinner")).toBe("/recipes?course=dinner");
    expect(foodCategoryFilterHref("grain")).toBe(
      "/recipes?foodCategory=grain"
    );
    expect(originFilterHref("mexican")).toBe("/recipes?origin=mexican");
    expect(costTierFilterHref("cheap")).toBe("/recipes?costTier=cheap");
    expect(dietaryFilterHref("vegan")).toBe("/recipes?dietary=vegan");
    expect(struggleFilterHref()).toBe("/recipes?struggle=1");
  });

  it("detail page chips are Links with filter hrefs", () => {
    const page = source("src/app/recipes/[id]/page.tsx");
    expect(page).toMatch(/cuisineFilterHref/);
    expect(page).toMatch(/courseFilterHref/);
    expect(page).toMatch(/foodCategoryFilterHref/);
    expect(page).toMatch(/costTierFilterHref/);
    expect(page).toMatch(/data-testid=\"chip-cuisine\"/);
    expect(page).toMatch(/linkToFilters/);
  });

  it("RecipeList forwards dietary/costTier/struggle to API", () => {
    const list = source("src/components/RecipeList.tsx");
    expect(list).toMatch(/dietaryParam/);
    expect(list).toMatch(/costTierParam/);
    expect(list).toMatch(/params\.set\(\"dietary\"/);
    expect(list).toMatch(/params\.set\(\"costTier\"/);
    expect(list).toMatch(/params\.set\(\"struggle\"/);
  });
});

describe("meat type hrefs + list card markers", () => {
  it("builds meatType filter URLs", () => {
    expect(meatTypeFilterHref("beef")).toBe(
      "/recipes?foodCategory=meat&meatType=beef"
    );
  });

  it("RecipeList has Make public + needs-cuisine UI", () => {
    const list = source("src/components/RecipeList.tsx");
    expect(list).toMatch(/card-make-public/);
    expect(list).toMatch(/needs-cuisine/);
    expect(list).toMatch(/card-cuisine-select/);
  });
});
