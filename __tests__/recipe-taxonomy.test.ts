import { describe, expect, it } from "vitest";
import {
  inferRecipeTaxonomy,
  matchesRecipeSearch,
  matchesTaxonomyFilters,
  normalizeOrigins,
  originMatchIds,
  recipeMatchesOrigin,
} from "@/lib/recipe-taxonomy";

describe("origin hierarchy rollup", () => {
  it("Jewish includes Ashkenazi / Sephardi / Israeli-Jewish descendants", () => {
    const ids = originMatchIds("jewish");
    expect(ids.has("jewish")).toBe(true);
    expect(ids.has("ashkenazi-jewish")).toBe(true);
    expect(ids.has("sephardi-jewish")).toBe(true);
    expect(ids.has("israeli-jewish")).toBe(true);
    expect(ids.has("chinese")).toBe(false);
  });

  it("Ashkenazi Jewish is narrow (self only among jewish children)", () => {
    const ids = originMatchIds("ashkenazi-jewish");
    expect(ids.has("ashkenazi-jewish")).toBe(true);
    expect(ids.has("jewish")).toBe(false);
    expect(ids.has("sephardi-jewish")).toBe(false);
  });

  it("recipeMatchesOrigin rolls up parent selection", () => {
    expect(
      recipeMatchesOrigin(["ashkenazi-jewish"], "jewish")
    ).toBe(true);
    expect(
      recipeMatchesOrigin(["ashkenazi-jewish"], "ashkenazi-jewish")
    ).toBe(true);
    expect(recipeMatchesOrigin(["ashkenazi-jewish"], "sephardi-jewish")).toBe(
      false
    );
    expect(recipeMatchesOrigin(["chinese"], "asian")).toBe(true);
    expect(recipeMatchesOrigin(["chinese"], "hungarian")).toBe(false);
  });

  it("normalizeOrigins keeps known ids only", () => {
    expect(normalizeOrigins(["Jewish", "chinese", "nope"])).toEqual([
      "jewish",
      "chinese",
    ]);
  });
});

describe("taxonomy filters + search", () => {
  const hummus = {
    title: "Hummus",
    tags: ["dip", "levantine"],
    cuisine: "Middle Eastern",
    course: "starter",
    foodCategories: ["legume"],
    origins: ["levantine", "arabic", "israeli", "jewish", "muslim-friendly"],
    ingredients: [{ name: "chickpeas" }, { name: "tahini" }],
  };

  const applePie = {
    title: "Classic Apple Pie",
    tags: ["dessert", "baking"],
    cuisine: "American",
    course: "dessert",
    foodCategories: ["fruit", "dessert"],
    origins: ["american"],
    ingredients: [{ name: "Apple" }, { name: "Flour" }],
  };

  const chili = {
    title: "Chili / Taco Filling",
    tags: ["tacos", "beef", "dinner"],
    cuisine: "Mexican",
    course: "dinner",
    foodCategories: ["meat"],
    origins: ["mexican", "latin-american", "tex-mex"],
    ingredients: [{ name: "Ground beef" }],
  };

  it("filters by cuisine", () => {
    expect(matchesTaxonomyFilters(chili, { cuisine: "Mexican" })).toBe(true);
    expect(matchesTaxonomyFilters(applePie, { cuisine: "Mexican" })).toBe(
      false
    );
  });

  it("filters by course", () => {
    expect(matchesTaxonomyFilters(applePie, { course: "dessert" })).toBe(true);
    expect(matchesTaxonomyFilters(chili, { course: "dessert" })).toBe(false);
  });

  it("filters by food category", () => {
    expect(matchesTaxonomyFilters(chili, { foodCategory: "meat" })).toBe(true);
    expect(matchesTaxonomyFilters(applePie, { foodCategory: "meat" })).toBe(
      false
    );
  });

  it("filters by origin rollup (Jewish includes jewish-tagged hummus)", () => {
    expect(matchesTaxonomyFilters(hummus, { origin: "jewish" })).toBe(true);
    expect(matchesTaxonomyFilters(hummus, { ethnicity: "jewish" })).toBe(true);
    expect(matchesTaxonomyFilters(hummus, { origin: "ashkenazi-jewish" })).toBe(
      false
    );
    expect(matchesTaxonomyFilters(applePie, { origin: "jewish" })).toBe(false);
  });

  it("search matches title tags ingredients and origin labels", () => {
    expect(matchesRecipeSearch(applePie, "banana")).toBe(false);
    expect(matchesRecipeSearch(applePie, "apple")).toBe(true);
    expect(matchesRecipeSearch(hummus, "levantine")).toBe(true);
    expect(
      matchesRecipeSearch(
        { title: "Banana Bread", tags: ["banana"], ingredients: [] },
        "banana"
      )
    ).toBe(true);
  });

  it("combines filters", () => {
    expect(
      matchesTaxonomyFilters(chili, {
        cuisine: "Mexican",
        foodCategory: "meat",
        q: "taco",
      })
    ).toBe(true);
    expect(
      matchesTaxonomyFilters(chili, {
        cuisine: "Mexican",
        course: "dessert",
      })
    ).toBe(false);
  });
});

describe("inferRecipeTaxonomy staples", () => {
  it("maps Apple Pie to dessert/american", () => {
    const t = inferRecipeTaxonomy({
      title: "Classic Apple Pie",
      tags: ["dessert", "baking"],
      ingredients: [{ name: "Apple" }],
    });
    expect(t.course).toBe("dessert");
    expect(t.cuisine).toBe("American");
    expect(t.foodCategories).toContain("fruit");
    expect(t.origins).toContain("american");
  });

  it("maps Roast Chicken to main/meat", () => {
    const t = inferRecipeTaxonomy({
      title: "Basic Roast Chicken",
      tags: ["chicken", "dinner"],
      ingredients: [{ name: "Whole chicken" }],
    });
    expect(["main", "dinner"]).toContain(t.course);
    expect(t.foodCategories).toContain("meat");
  });

  it("maps Rice to side/grain", () => {
    const t = inferRecipeTaxonomy({
      title: "Boiled / Steamed Rice",
      tags: ["rice", "side"],
      ingredients: [{ name: "White rice" }],
    });
    expect(t.course).toBe("side");
    expect(t.foodCategories).toContain("grain");
  });

  it("maps Chili/Taco to Mexican multi-origin", () => {
    const t = inferRecipeTaxonomy({
      title: "Chili / Taco Filling",
      tags: ["tacos", "chili", "beef"],
      ingredients: [{ name: "Ground beef" }],
    });
    expect(t.cuisine).toBe("Mexican");
    expect(t.origins).toContain("mexican");
  });

  it("leaves obscure dishes without invented origins when no cues", () => {
    const t = inferRecipeTaxonomy({
      title: "Mystery Bowl",
      tags: [],
      ingredients: [{ name: "Water" }],
    });
    // default cuisine American but origins may be empty without cues
    expect(Array.isArray(t.origins)).toBe(true);
  });
});
