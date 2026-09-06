import { describe, expect, it } from "vitest";
import {
  defaultUnitForItem,
  inferMeasureKind,
  unitsForItem,
} from "@/lib/units";
import { findCatalogItem } from "@/lib/pantry-catalog";
import { mergeCatalogWithCustoms } from "@/lib/custom-staples-shared";

describe("substance-aware pantry units", () => {
  it("offers liquid units for milk (not gallons-only weight)", () => {
    const units = unitsForItem("Milk", "Dairy", "liquid");
    expect(units).toEqual(
      expect.arrayContaining(["fl oz", "cups", "pints", "quarts", "gallons", "ml", "L"])
    );
    expect(units[0]).toBe("fl oz");
    expect(findCatalogItem("Milk")?.measureKind).toBe("liquid");
  });

  it("offers weight for mozzarella / cream cheese (no gallons)", () => {
    for (const name of ["Mozzarella", "Cream cheese"]) {
      const units = unitsForItem(name, "Dairy");
      expect(units).toEqual(expect.arrayContaining(["oz", "lb", "g"]));
      expect(units).not.toContain("gallons");
      expect(units).not.toContain("fl oz");
    }
  });

  it("offers yogurt-style units (volume + tub weight)", () => {
    const units = unitsForItem("Yogurt", "Dairy");
    expect(units).toEqual(
      expect.arrayContaining(["fl oz", "cups", "oz", "g"])
    );
  });

  it("offers weight for ground beef and dry pasta", () => {
    expect(unitsForItem("Ground beef", "Proteins")).toEqual(
      expect.arrayContaining(["oz", "lb", "g", "kg"])
    );
    expect(unitsForItem("Spaghetti", "Grains")).toEqual(
      expect.arrayContaining(["oz", "lb", "g"])
    );
  });

  it("offers count for eggs and produce count+weight", () => {
    expect(unitsForItem("Eggs", "Proteins")).toEqual(
      expect.arrayContaining(["each", "dozen"])
    );
    expect(unitsForItem("Yellow onion", "Produce")).toEqual(
      expect.arrayContaining(["each", "lb", "oz"])
    );
    expect(unitsForItem("Apple", "Produce")).toEqual(
      expect.arrayContaining(["each", "lb", "oz"])
    );
  });

  it("offers oil and spice and baking units", () => {
    expect(unitsForItem("Olive oil", "Oils & Condiments")).toEqual(
      expect.arrayContaining(["fl oz", "cups", "tbsp", "ml"])
    );
    expect(unitsForItem("Salt", "Spices")).toEqual(
      expect.arrayContaining(["tsp", "tbsp", "oz", "g"])
    );
    expect(unitsForItem("Flour", "Baking")).toEqual(
      expect.arrayContaining(["cups", "oz", "lb", "g", "kg"])
    );
  });

  it("defaults to suggestedUnit when present in list", () => {
    expect(defaultUnitForItem("Ground beef", "Proteins", "lb")).toBe("lb");
    expect(defaultUnitForItem("Milk", "Dairy", "fl oz")).toBe("fl oz");
  });

  it("infers measure kinds from custom names + category", () => {
    expect(inferMeasureKind("labneh", "Dairy")).toBe("semi_solid");
    expect(inferMeasureKind("wagyu ribeye", "Proteins")).toBe("solid_weight");
    expect(inferMeasureKind("romanesco", "Produce")).toBe("produce");
    expect(inferMeasureKind("00 flour", "Baking")).toBe("volume_dry");
  });
});

describe("mergeCatalogWithCustoms category scoping", () => {
  it("keeps customs under their own category only", () => {
    const dairyStatic = [
      { name: "Milk", category: "Dairy" as const, measureKind: "liquid" as const },
    ];
    const customs = [
      {
        id: "1",
        name: "labana",
        category: "Dairy",
        measureKind: "semi_solid",
        suggestedUnit: "oz",
        hidden: false,
        householdId: null,
        createdAt: "",
        updatedAt: "",
        custom: true as const,
      },
      {
        id: "2",
        name: "wagyu mince",
        category: "Proteins",
        measureKind: "solid_weight",
        suggestedUnit: "lb",
        hidden: false,
        householdId: null,
        createdAt: "",
        updatedAt: "",
        custom: true as const,
      },
    ];
    const dairyMerged = mergeCatalogWithCustoms(
      dairyStatic,
      customs.filter((c) => c.category === "Dairy")
    );
    expect(dairyMerged.map((i) => i.name)).toContain("labana");
    expect(dairyMerged.map((i) => i.name)).not.toContain("wagyu mince");

    const proteinMerged = mergeCatalogWithCustoms(
      [{ name: "Ground beef", category: "Proteins" }],
      customs.filter((c) => c.category === "Proteins")
    );
    expect(proteinMerged.map((i) => i.name)).toContain("wagyu mince");
    expect(proteinMerged.map((i) => i.name)).not.toContain("labana");
  });
});
