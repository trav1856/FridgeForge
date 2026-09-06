import { describe, expect, it } from "vitest";
import {
  CATALOG_CHIPS,
  PANTRY_CATALOG,
  PANTRY_UNITS,
  findCatalogItem,
  itemsForChip,
} from "@/lib/pantry-catalog";
import { isStapleOrClassicTagJson } from "@/lib/clone-staples";

describe("pantry catalog", () => {
  it("exports staples across major categories", () => {
    expect(PANTRY_CATALOG.length).toBeGreaterThan(40);
    expect(CATALOG_CHIPS.map((c) => c.id)).toContain("meat");
    expect(CATALOG_CHIPS.map((c) => c.id)).toContain("grains");
    expect(PANTRY_UNITS).toContain("oz");
    expect(findCatalogItem("Spaghetti")?.defaultQty).toBe(8);
    expect(findCatalogItem("Ground beef")?.defaultUnit).toBe("lb");
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
});

describe("staple tag helper", () => {
  it("detects staple or classic tags", () => {
    expect(isStapleOrClassicTagJson('["staple","classic"]')).toBe(true);
    expect(isStapleOrClassicTagJson('["struggle","rice"]')).toBe(false);
    expect(isStapleOrClassicTagJson("not-json")).toBe(false);
  });
});
