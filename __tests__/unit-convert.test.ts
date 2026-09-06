import { describe, expect, it } from "vitest";
import {
  convertIngredient,
  convertRecipeIngredients,
  formatQuantity,
  roundCooking,
} from "@/lib/unit-convert";

describe("unit-convert", () => {
  it("converts cups to ml (240)", () => {
    const r = convertIngredient(1, "cup", "metric");
    expect(r.unit).toBe("ml");
    expect(r.quantity).toBe(240);
    expect(r.unchanged).toBe(false);
  });

  it("converts tbsp/tsp/fl oz to ml", () => {
    expect(convertIngredient(1, "tbsp", "metric")).toMatchObject({
      quantity: 15,
      unit: "ml",
    });
    expect(convertIngredient(1, "tsp", "metric")).toMatchObject({
      quantity: 5,
      unit: "ml",
    });
    expect(convertIngredient(1, "fl oz", "metric")).toMatchObject({
      quantity: 30,
      unit: "ml",
    });
  });

  it("converts oz to grams (~28.35)", () => {
    const r = convertIngredient(8, "oz", "metric");
    expect(r.unit).toBe("g");
    expect(r.quantity).toBe(roundCooking(8 * 28.35));
    expect(r.quantity).toBe(227);
  });

  it("converts lb to g/kg and kg to lb", () => {
    const lb = convertIngredient(1, "lb", "metric");
    expect(lb.unit).toBe("g");
    expect(lb.quantity).toBe(454);

    const kg = convertIngredient(1, "kg", "imperial");
    expect(kg.unit).toBe("lb");
    expect(kg.quantity).toBe(roundCooking(1000 / 453.592));
  });

  it("leaves count units unchanged", () => {
    for (const u of ["each", "clove", "cans", "pinch", "dozen"]) {
      const r = convertIngredient(2, u, "metric");
      expect(r.unchanged).toBe(true);
      expect(r.quantity).toBe(2);
      expect(r.unit).toBe(u);
    }
  });

  it("round-trips cups via metric then imperial", () => {
    const metric = convertIngredient(2, "cups", "metric");
    expect(metric.quantity).toBe(480);
    const back = convertIngredient(metric.quantity, metric.unit, "imperial");
    expect(back.unit).toBe("cups");
    expect(back.quantity).toBe(2);
  });

  it("converts recipe ingredient lists", () => {
    const out = convertRecipeIngredients(
      [
        { id: "1", name: "flour", quantity: 1, unit: "cup", optional: false },
        { id: "2", name: "egg", quantity: 2, unit: "each", optional: false },
      ],
      "metric"
    );
    expect(out[0]).toMatchObject({ quantity: 240, unit: "ml" });
    expect(out[1]).toMatchObject({ quantity: 2, unit: "each", unchanged: true });
  });

  it("formats quantities cleanly", () => {
    expect(formatQuantity(240)).toBe("240");
    expect(formatQuantity(226.8)).toBe("226.8");
  });
});
