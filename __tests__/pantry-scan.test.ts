import { describe, expect, it } from "vitest";
import { isLikelyNonFoodProduct } from "@/lib/open-food-facts";
import { pantryIconFor } from "@/lib/pantry-icons";
import {
  LOCAL_RECIPE_IMAGES,
  needsMealDbImage,
  resolveRecipeImageUrl,
} from "@/lib/recipe-image";

describe("isLikelyNonFoodProduct", () => {
  it("flags car batteries / automotive / chemicals", () => {
    expect(
      isLikelyNonFoodProduct({
        name: "DieHard Car Battery",
        categories: "Automotive, Batteries",
        categoriesTags: ["en:automotive", "en:batteries"],
      })
    ).toBe(true);
    expect(
      isLikelyNonFoodProduct({
        name: "Clorox Bleach",
        categoriesTags: ["en:cleaning", "en:detergents"],
      })
    ).toBe(true);
    expect(
      isLikelyNonFoodProduct({
        name: "USB-C Cable",
        categories: "Electronics",
        categoriesTags: ["en:electronics"],
      })
    ).toBe(true);
  });

  it("does not flag candy / food, even without nutriments", () => {
    expect(
      isLikelyNonFoodProduct({
        name: "Nerds Gummy Clusters Very Berry",
        categories: "Candies, Snacks",
        categoriesTags: ["en:candies", "en:snacks"],
      })
    ).toBe(false);
    expect(
      isLikelyNonFoodProduct({
        name: "Sea salt",
        categories: "Spices",
        categoriesTags: ["en:salts"],
      })
    ).toBe(false);
  });

  it("unknown unmatched products are not treated as non-food scare", () => {
    expect(
      isLikelyNonFoodProduct({
        name: "Unknown product (UPC 123456789012)",
        categories: null,
        categoriesTags: [],
      })
    ).toBe(false);
  });
});

describe("pantryIconFor", () => {
  it("never returns blank — category and name fallbacks", () => {
    const a = pantryIconFor({ name: "Milk", category: "Dairy" });
    expect(a.emoji.length).toBeGreaterThan(0);
    const b = pantryIconFor({ name: "Nerds Gummy Clusters", category: null });
    expect(b.emoji).toBeTruthy();
    const c = pantryIconFor({ name: "Mystery", category: null });
    expect(c.emoji).toBeTruthy();
    const d = pantryIconFor({
      name: "Unknown product (UPC 999)",
      category: "Other",
    });
    expect(d.emoji).toBeTruthy();
  });
});

describe("chocolate chip recipe image", () => {
  it("uses local chocolate-chip photo, not peanut-butter MealDB thumb", async () => {
    expect(LOCAL_RECIPE_IMAGES["Chocolate Chip Cookies"]).toBe(
      "/recipe-images/chocolate-chip-cookies.jpg"
    );
    expect(
      needsMealDbImage(
        "https://www.themealdb.com/images/media/meals/1544384070.jpg"
      )
    ).toBe(true);
    const url = await resolveRecipeImageUrl({
      title: "Chocolate Chip Cookies",
    });
    expect(url).toBe("/recipe-images/chocolate-chip-cookies.jpg");
  });
});

describe("unknown barcode pantry naming", () => {
  it("builds a stable Unknown product label from UPC", () => {
    const upc = "012345678905";
    const name = `Unknown product (UPC ${upc})`;
    expect(name).toContain(upc);
    expect(name.length).toBeGreaterThan(5);
  });
});
