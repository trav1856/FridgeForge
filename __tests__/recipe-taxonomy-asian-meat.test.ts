import { describe, expect, it } from "vitest";
import {
  ASIAN_CHILD_CUISINES,
  EASTERN_EUROPEAN_CHILD_CUISINES,
  CUISINES,
  inferRecipeTaxonomy,
  matchesTaxonomyFilters,
  normalizeCuisine,
  recipeMatchesCuisineFilter,
  resolveTaxonomyForWrite,
  ensureAsianParentOrigins,
  ensureEasternEuropeanParentOrigins,
  ensureParentCuisineOrigins,
} from "@/lib/recipe-taxonomy";
import {
  cuisineFilterHref,
  foodCategoryFilterHref,
  meatTypeFilterHref,
} from "@/lib/recipe-filter-hrefs";

describe("cuisine list expansions", () => {
  it("includes Cambodian, EE family, Filipino, Native American, Caribbean", () => {
    for (const c of [
      "Cambodian",
      "Eastern European",
      "Russian",
      "Ukrainian",
      "Polish",
      "Belarusian",
      "Filipino",
      "Native American",
      "Caribbean",
    ]) {
      expect(CUISINES).toContain(c);
    }
  });

  it("maps Philippine → Filipino", () => {
    expect(normalizeCuisine("Philippine")).toBe("Filipino");
    expect(normalizeCuisine("philippines")).toBe("Filipino");
  });
});

describe("Asian parent rollup", () => {
  it("Asian-linked set includes Indian + East/SE; excludes Russian", () => {
    expect(ASIAN_CHILD_CUISINES).toContain("Korean");
    expect(ASIAN_CHILD_CUISINES).toContain("Indian");
    expect(ASIAN_CHILD_CUISINES).toContain("Cambodian");
    expect(ASIAN_CHILD_CUISINES).not.toContain("Russian");
  });

  it("EE-linked set includes Russian/Ukrainian/Polish/Belarusian", () => {
    for (const c of ["Russian", "Ukrainian", "Polish", "Belarusian"]) {
      expect(EASTERN_EUROPEAN_CHILD_CUISINES).toContain(c);
    }
  });

  it("Korean / Indian match cuisine=Asian; Russian does not", () => {
    expect(recipeMatchesCuisineFilter("Korean", "Asian")).toBe(true);
    expect(recipeMatchesCuisineFilter("Indian", "Asian")).toBe(true);
    expect(recipeMatchesCuisineFilter("Cambodian", "Asian")).toBe(true);
    expect(recipeMatchesCuisineFilter("Russian", "Asian")).toBe(false);
    expect(recipeMatchesCuisineFilter("American", "Asian")).toBe(false);
  });

  it("Russian matches Eastern European parent filter", () => {
    expect(
      recipeMatchesCuisineFilter("Russian", "Eastern European")
    ).toBe(true);
    expect(
      recipeMatchesCuisineFilter("Polish", "Eastern European")
    ).toBe(true);
    expect(
      recipeMatchesCuisineFilter("Korean", "Eastern European")
    ).toBe(false);
  });

  it("matchesTaxonomyFilters Asian includes Korean; EE includes Russian", () => {
    expect(
      matchesTaxonomyFilters(
        { title: "Bulgogi", cuisine: "Korean", origins: ["korean", "asian"] },
        { cuisine: "Asian" }
      )
    ).toBe(true);
    expect(
      matchesTaxonomyFilters(
        { title: "Butter Chicken", cuisine: "Indian", origins: ["indian", "asian"] },
        { cuisine: "Asian" }
      )
    ).toBe(true);
    expect(
      matchesTaxonomyFilters(
        { title: "Borscht", cuisine: "Russian", origins: ["eastern-european"] },
        { cuisine: "Asian" }
      )
    ).toBe(false);
    expect(
      matchesTaxonomyFilters(
        { title: "Borscht", cuisine: "Russian", origins: ["eastern-european"] },
        { cuisine: "Eastern European" }
      )
    ).toBe(true);
  });

  it("selecting Korean/Indian → asian; Russian → eastern-european", () => {
    expect(ensureAsianParentOrigins("Korean", [])).toContain("asian");
    expect(ensureAsianParentOrigins("Indian", ["indian"])).toEqual(
      expect.arrayContaining(["indian", "asian"])
    );
    expect(ensureAsianParentOrigins("Russian", [])).not.toContain("asian");
    expect(ensureEasternEuropeanParentOrigins("Russian", [])).toContain(
      "eastern-european"
    );
    expect(ensureParentCuisineOrigins("Polish", [])).toContain(
      "eastern-european"
    );
  });
});

describe("inference staples (cuisine + meat)", () => {
  it("bulgogi → Korean (+ asian origins) and beef", () => {
    const t = inferRecipeTaxonomy({ title: "Beef Bulgogi" });
    expect(t.cuisine).toBe("Korean");
    expect(t.origins).toContain("asian");
    expect(t.origins).toContain("korean");
    expect(t.meatType).toBe("beef");
    expect(t.foodCategories).toContain("meat");
  });

  it("kimchi → Korean", () => {
    const t = inferRecipeTaxonomy({ title: "Kimchi-Bokkeumbap" });
    expect(t.cuisine).toBe("Korean");
    expect(t.origins).toContain("asian");
  });

  it("pad thai → Thai (+Asian)", () => {
    const t = inferRecipeTaxonomy({ title: "Pad Thai" });
    expect(t.cuisine).toBe("Thai");
    expect(t.origins).toContain("asian");
  });

  it("amok / lok lak → Cambodian (+Asian)", () => {
    expect(inferRecipeTaxonomy({ title: "Fish Amok" }).cuisine).toBe(
      "Cambodian"
    );
    const lok = inferRecipeTaxonomy({ title: "Lok Lak" });
    expect(lok.cuisine).toBe("Cambodian");
    expect(lok.origins).toContain("asian");
  });

  it("borscht / stroganoff → Russian + Eastern European (not Asian)", () => {
    const b = inferRecipeTaxonomy({ title: "Borscht" });
    expect(b.cuisine).toBe("Russian");
    expect(b.origins).toContain("eastern-european");
    expect(b.origins).not.toContain("asian");
    const s = inferRecipeTaxonomy({ title: "Beef Stroganoff" });
    expect(s.cuisine).toBe("Russian");
    expect(s.meatType).toBe("beef");
  });

  it("pierogi / kielbasa → Polish; varenyky → Ukrainian", () => {
    expect(inferRecipeTaxonomy({ title: "Pierogi" }).cuisine).toBe("Polish");
    expect(inferRecipeTaxonomy({ title: "Kielbasa" }).cuisine).toBe("Polish");
    expect(inferRecipeTaxonomy({ title: "Varenyky" }).cuisine).toBe(
      "Ukrainian"
    );
    expect(
      inferRecipeTaxonomy({ title: "Bigos Stew" }).origins
    ).toContain("eastern-european");
  });

  it("empanadas → Mexican", () => {
    expect(inferRecipeTaxonomy({ title: "Beef Empanadas" }).cuisine).toBe(
      "Mexican"
    );
  });

  it("hamantaschen / jewish apple cake → American + jewish, not forced ME", () => {
    const h = inferRecipeTaxonomy({ title: "Hamantaschen" });
    expect(h.cuisine).toBe("American");
    expect(h.origins).toContain("jewish");
    const a = inferRecipeTaxonomy({ title: "Jewish Apple Cake" });
    expect(a.cuisine).toBe("American");
    expect(a.origins).toContain("jewish");
  });

  it("jerk → Caribbean", () => {
    expect(inferRecipeTaxonomy({ title: "Jerk Chicken" }).cuisine).toBe(
      "Caribbean"
    );
  });

  it("fish/shrimp → seafood not meat", () => {
    const t = inferRecipeTaxonomy({
      title: "Garlic Shrimp",
      ingredients: [{ name: "shrimp" }],
    });
    expect(t.foodCategories).toContain("seafood");
    expect(t.foodCategories).not.toContain("meat");
    expect(t.meatType).toBeNull();
  });

  it("pork / chicken / lamb meatType", () => {
    expect(
      inferRecipeTaxonomy({ title: "Pork Adobo" }).meatType
    ).toBe("pork");
    expect(
      inferRecipeTaxonomy({ title: "Roast Chicken" }).meatType
    ).toBe("chicken");
    expect(
      inferRecipeTaxonomy({ title: "Lamb Stew" }).meatType
    ).toBe("other");
  });
});

describe("resolveTaxonomyForWrite on empty cuisine", () => {
  it("fills Korean for bulgogi when cuisine blank", () => {
    const r = resolveTaxonomyForWrite({
      title: "Beef Bulgogi",
      ingredients: [{ name: "beef" }, { name: "soy sauce" }],
      steps: ["Marinate and grill"],
      cuisine: null,
    });
    expect(r.cuisine).toBe("Korean");
    expect(r.origins).toContain("asian");
    expect(r.meatType).toBe("beef");
  });
});

describe("filter hrefs", () => {
  it("meat and meatType hrefs", () => {
    expect(foodCategoryFilterHref("meat")).toBe("/recipes?foodCategory=meat");
    expect(meatTypeFilterHref("beef")).toBe(
      "/recipes?foodCategory=meat&meatType=beef"
    );
    expect(cuisineFilterHref("Korean")).toBe("/recipes?cuisine=Korean");
  });
});
