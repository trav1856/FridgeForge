import { describe, expect, it } from "vitest";
import { namesMatch } from "@/lib/normalize";
import {
  amountToDeductInPantryUnit,
  findMatchingPantryItem,
  isLowStock,
  lowStockMessage,
  planPantryDeductions,
  planPantryRestore,
} from "@/lib/pantry-deduct";
import { convertToUnit } from "@/lib/unit-convert";

describe("pantry-deduct math", () => {
  it("deducts ½ lb butter from 1 lb → ½ lb", () => {
    const plan = planPantryDeductions(
      [{ name: "butter", quantity: 0.5, unit: "lb" }],
      [{ id: "p1", name: "Butter", quantity: 1, unit: "lb" }]
    );
    expect(plan.deductions).toHaveLength(1);
    expect(plan.deductions[0]).toMatchObject({
      pantryItemId: "p1",
      deductedQty: 0.5,
      quantityBefore: 1,
      quantityAfter: 0.5,
    });
  });

  it("converts oz recipe amount into lb pantry unit", () => {
    expect(amountToDeductInPantryUnit(8, "oz", "lb")).toBeCloseTo(0.5, 1);
    const plan = planPantryDeductions(
      [{ name: "butter", quantity: 8, unit: "oz" }],
      [{ id: "p1", name: "salted butter", quantity: 1, unit: "lb" }]
    );
    expect(plan.deductions[0]!.quantityAfter).toBeCloseTo(0.5, 1);
  });

  it("floors at 0 and keeps the row (no delete)", () => {
    const plan = planPantryDeductions(
      [{ name: "butter", quantity: 2, unit: "lb" }],
      [{ id: "p1", name: "butter", quantity: 1, unit: "lb" }]
    );
    expect(plan.deductions[0]!.quantityAfter).toBe(0);
    expect(plan.deductions[0]!.lowStock).toBe(true);
  });

  it("skips optional when missing; deducts optional when present", () => {
    const missing = planPantryDeductions(
      [{ name: "parsley", quantity: 1, unit: "tbsp", optional: true }],
      [{ id: "p1", name: "butter", quantity: 1, unit: "lb" }]
    );
    expect(missing.deductions).toHaveLength(0);
    expect(missing.skipped[0]?.reason).toBe("optional_missing");

    const present = planPantryDeductions(
      [{ name: "parsley", quantity: 1, unit: "tbsp", optional: true }],
      [{ id: "p1", name: "fresh parsley", quantity: 4, unit: "tbsp" }]
    );
    expect(present.deductions[0]!.quantityAfter).toBe(3);
  });

  it("skips incompatible units", () => {
    const plan = planPantryDeductions(
      [{ name: "milk", quantity: 1, unit: "cup" }],
      [{ id: "p1", name: "milk", quantity: 1, unit: "each" }]
    );
    expect(plan.deductions).toHaveLength(0);
    expect(plan.skipped[0]?.reason).toBe("unit_mismatch");
  });
});

describe("name match for cook deduct", () => {
  it("matches butter aliases and rejects peanut butter", () => {
    expect(namesMatch("butter", "salted butter")).toBe(true);
    expect(namesMatch("butter", "peanut butter")).toBe(false);
    const hit = findMatchingPantryItem("butter", [
      { id: "1", name: "peanut butter" },
      { id: "2", name: "unsalted butter" },
    ]);
    expect(hit?.id).toBe("2");
  });
});

describe("low stock flag", () => {
  it("flags empty and ≤25% remaining", () => {
    expect(isLowStock(0, 1, "lb")).toBe(true);
    expect(isLowStock(0.2, 1, "lb")).toBe(true); // 20%
    expect(isLowStock(0.5, 1, "lb")).toBe(false); // 50%, above 0.25 abs? 0.5 > 0.25
  });

  it("flags absolute floor (≤0.25 lb)", () => {
    expect(isLowStock(0.2, 2, "lb")).toBe(true);
  });

  it("builds nudge copy", () => {
    expect(lowStockMessage("butter", 0, "lb")).toBe(
      "You probably need more butter."
    );
    expect(lowStockMessage("butter", 0.5, "lb")).toContain("butter");
    expect(lowStockMessage("butter", 0.5, "lb")).toContain("0.5");
  });

  it("marks lowStock on plan when remaining hits floor", () => {
    const plan = planPantryDeductions(
      [{ name: "butter", quantity: 0.9, unit: "lb" }],
      [{ id: "p1", name: "butter", quantity: 1, unit: "lb" }]
    );
    // 0.1 left → ≤25% and ≤0.25 abs
    expect(plan.deductions[0]!.quantityAfter).toBeCloseTo(0.1, 5);
    expect(plan.deductions[0]!.lowStock).toBe(true);
    expect(plan.lowStockMessages[0]).toMatch(/low on butter/i);
  });
});

describe("restore", () => {
  it("restores quantityBefore", () => {
    const restore = planPantryRestore([
      {
        pantryItemId: "p1",
        quantityBefore: 1,
      },
    ]);
    expect(restore).toEqual([{ pantryItemId: "p1", quantity: 1 }]);
  });
});

describe("convertToUnit", () => {
  it("converts lb ↔ oz", () => {
    expect(convertToUnit(1, "lb", "oz")).toBeCloseTo(16, 0);
    expect(convertToUnit(8, "oz", "lb")).toBeCloseTo(0.5, 2);
  });
});
