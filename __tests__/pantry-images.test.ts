import { describe, expect, it } from "vitest";
import {
  genericPantryImageForName,
  isBrandPantryImage,
  isGenericPantryImage,
  prefersGenericPantryImage,
  resolvePantryImageUrl,
} from "@/lib/pantry-images";
import { existsSync } from "fs";
import { join } from "path";

describe("pantry-images", () => {
  it("maps common staples to curated generic assets that exist on disk", () => {
    const milk = genericPantryImageForName("milk");
    expect(milk).toBe("/pantry-images/generic/milk.svg");
    expect(
      existsSync(join(process.cwd(), "public", milk!.replace(/^\//, "")))
    ).toBe(true);

    expect(genericPantryImageForName("gallon of whole milk")).toContain(
      "milk.svg"
    );
    expect(genericPantryImageForName("Eggs")).toContain("eggs.svg");
    expect(genericPantryImageForName("White rice")).toContain("rice.svg");
    expect(genericPantryImageForName("Ground beef")).toContain("beef.svg");
    expect(genericPantryImageForName("Olive oil")).toContain("oil.svg");
  });

  it("falls back by category then other", () => {
    expect(genericPantryImageForName("Mystery spice blend", "Spices")).toContain(
      "spice.svg"
    );
    expect(genericPantryImageForName("Completely unknown xyz")).toContain(
      "other.svg"
    );
  });

  it("prefers stored brand URL over generic; resolves generic when empty", () => {
    const brand =
      "https://images.openfoodfacts.org/images/products/004/parkay.jpg";
    expect(
      resolvePantryImageUrl({
        name: "Parkay Margarine",
        imageUrl: brand,
      })
    ).toBe(brand);
    expect(
      resolvePantryImageUrl({ name: "Milk", imageUrl: null, category: "Dairy" })
    ).toBe("/pantry-images/generic/milk.svg");
  });

  it("detects generic vs brand URLs", () => {
    expect(isGenericPantryImage("/pantry-images/generic/milk.svg")).toBe(true);
    expect(
      isBrandPantryImage(
        "https://images.openfoodfacts.org/images/products/x.jpg"
      )
    ).toBe(true);
    expect(isBrandPantryImage("/pantry-images/generic/milk.svg")).toBe(false);
  });

  it("prefers generic for commodities; not for branded multi-word names", () => {
    expect(prefersGenericPantryImage("milk")).toBe(true);
    expect(prefersGenericPantryImage("Eggs")).toBe(true);
    expect(prefersGenericPantryImage("gallon of whole milk")).toBe(true);
    expect(prefersGenericPantryImage("Parkay Margarine")).toBe(false);
    expect(prefersGenericPantryImage("Hellmann's Mayonnaise")).toBe(false);
  });
});
