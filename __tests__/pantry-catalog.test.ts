import { describe, expect, it } from "vitest";
import {
  CATALOG_CHIPS,
  PANTRY_CATALOG,
  PANTRY_UNITS,
  fatTagFromSelection,
  findCatalogItem,
  itemsForChip,
  suggestedUnitForCategory,
} from "@/lib/pantry-catalog";
import { PANTRY_CATEGORIES, suggestCategoryFromOff } from "@/lib/categories";
import { isStapleOrClassicTagJson } from "@/lib/clone-staples";
import {
  formatNutritionBlurb,
  nutritionFromOffProduct,
  parseNutritionJson,
} from "@/lib/open-food-facts";

describe("pantry catalog", () => {
  it("exports staples across major categories including Baking", () => {
    expect(PANTRY_CATALOG.length).toBeGreaterThan(40);
    expect(CATALOG_CHIPS.map((c) => c.id)).toContain("meat");
    expect(CATALOG_CHIPS.map((c) => c.id)).toContain("grains");
    expect(CATALOG_CHIPS.map((c) => c.id)).toContain("baking");
    expect(PANTRY_CATEGORIES).toContain("Baking");
    expect(PANTRY_UNITS).toContain("oz");
    expect(findCatalogItem("Spaghetti")?.suggestedUnit).toBe("oz");
    expect(findCatalogItem("Ground beef")?.suggestedUnit).toBe("lb");
    expect(findCatalogItem("Flour")?.category).toBe("Baking");
    expect(findCatalogItem("Milk")?.suggestedUnit).toBe("fl oz");
    expect(findCatalogItem("Milk")?.measureKind).toBe("liquid");
    expect(findCatalogItem("Brown sugar")?.category).toBe("Baking");
  });

  it("chips expose name only — no qty encoded on catalog items for labels", () => {
    for (const item of PANTRY_CATALOG) {
      expect(item).not.toHaveProperty("defaultQty");
      expect(item.name).toBeTruthy();
      expect(item.name).not.toMatch(/\d+\s*(lb|oz|cups)/i);
    }
  });

  it("filters produce veg vs fruit chips", () => {
    const veg = CATALOG_CHIPS.find((c) => c.id === "veg")!;
    const fruit = CATALOG_CHIPS.find((c) => c.id === "fruit")!;
    const vegNames = itemsForChip(veg).map((i) => i.name);
    const fruitNames = itemsForChip(fruit).map((i) => i.name);
    expect(vegNames).toContain("Yellow onion");
    expect(vegNames).not.toContain("Apple");
    expect(fruitNames).toContain("Apple");
    expect(fruitNames).not.toContain("Potato");
  });

  it("lists baking staples under Baking chip", () => {
    const baking = CATALOG_CHIPS.find((c) => c.id === "baking")!;
    const names = itemsForChip(baking).map((i) => i.name);
    expect(names).toContain("Flour");
    expect(names).toContain("Chocolate chips");
    expect(names).toContain("Yeast");
  });

  it("suggests category units and fat tags", () => {
    expect(suggestedUnitForCategory("Proteins")).toBe("oz");
    expect(suggestedUnitForCategory("Produce")).toBe("each");
    expect(suggestedUnitForCategory("Baking")).toBe("cups");
    expect(fatTagFromSelection("80%")).toBe("fat:80%");
    expect(fatTagFromSelection("")).toBeNull();
    expect(fatTagFromSelection("other")).toBe("fat:other");
  });
});

describe("OFF category suggestor baking", () => {
  it("maps baking terms to Baking", () => {
    expect(suggestCategoryFromOff(["en:flours"], "wheat flour")).toBe("Baking");
    expect(suggestCategoryFromOff([], "brown sugar baking")).toBe("Baking");
    expect(suggestCategoryFromOff(["en:pastas"], "spaghetti")).toBe("Grains");
  });
});

describe("nutrition parse smoke", () => {
  it("parses OFF nutriments and formats blurbs", () => {
    const snap = nutritionFromOffProduct({
      product_name: "Ground beef",
      nutriments: {
        "energy-kcal_100g": 250,
        proteins_100g: 17,
        fat_100g: 20,
        carbohydrates_100g: 0,
      },
    });
    expect(snap?.caloriesPer100g).toBe(250);
    expect(snap?.proteinPer100g).toBe(17);
    const json = JSON.stringify(snap);
    expect(parseNutritionJson(json)?.source).toBe("openfoodfacts");
    expect(formatNutritionBlurb(json)).toContain("250 kcal");
    expect(formatNutritionBlurb(json)).toContain("/100g");
    expect(formatNutritionBlurb(null)).toBeNull();
    expect(nutritionFromOffProduct({ product_name: "x" })).toBeNull();
  });
});

describe("staple tag helper", () => {
  it("detects staple or classic tags", () => {
    expect(isStapleOrClassicTagJson('["staple","classic"]')).toBe(true);
    expect(isStapleOrClassicTagJson('["struggle","rice"]')).toBe(false);
    expect(isStapleOrClassicTagJson("not-json")).toBe(false);
  });
});
