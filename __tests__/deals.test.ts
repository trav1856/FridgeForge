import { describe, expect, it } from "vitest";
import {
  couponMatchesIngredient,
  findDealsForMissingIngredients,
} from "@/lib/deals";

const sample = (
  partial: Partial<{
    id: string;
    brand: string;
    title: string;
    discountText: string;
    codeValue: string;
    used: boolean;
    expiresAt: Date | null;
  }> = {}
) => ({
  id: partial.id ?? "c1",
  brand: partial.brand ?? "Brand",
  title: partial.title ?? "Title",
  discountText: partial.discountText ?? "$1 OFF",
  codeValue: partial.codeValue ?? "CODE-1",
  used: partial.used ?? false,
  expiresAt: partial.expiresAt === undefined ? new Date(Date.now() + 86400000) : partial.expiresAt,
});

describe("couponMatchesIngredient", () => {
  it("matches pasta via title keywords", () => {
    const c = sample({
      brand: "Al Dente Mill",
      title: "Any spaghetti or pasta 12 oz+",
      codeValue: "ALDENTE-PASTA-100",
    });
    expect(couponMatchesIngredient(c, "Spaghetti")).toBe(true);
    expect(couponMatchesIngredient(c, "pasta")).toBe(true);
  });

  it("matches tomato sauce coupon to canned tomatoes", () => {
    const c = sample({
      brand: "Red Jar Kitchen",
      title: "Pasta sauce or tomato sauce 24 oz",
    });
    expect(couponMatchesIngredient(c, "Canned diced tomatoes")).toBe(true);
  });

  it("pasta sauce coupon does not match spaghetti noodles", () => {
    const c = sample({
      brand: "Red Jar Kitchen",
      title: "Pasta sauce or tomato sauce 24 oz",
    });
    expect(couponMatchesIngredient(c, "Spaghetti")).toBe(false);
  });

  it("matches beans coupon to dry black beans", () => {
    const c = sample({
      brand: "Valley Beans Co.",
      title: "Black, pinto, or dry beans (canned or bag)",
    });
    expect(couponMatchesIngredient(c, "Dry black beans")).toBe(true);
  });

  it("matches butter coupons", () => {
    const c = sample({
      brand: "Meadow Creamery",
      title: "Salted or unsalted butter sticks",
      codeValue: "MEADOW-BUTTER-100",
    });
    expect(couponMatchesIngredient(c, "Butter")).toBe(true);
  });
});

describe("findDealsForMissingIngredients", () => {
  const coupons = [
    sample({
      id: "pasta",
      brand: "Al Dente Mill",
      title: "Any spaghetti or pasta 12 oz+",
      codeValue: "ALDENTE-PASTA-100",
    }),
    sample({
      id: "beans",
      brand: "Valley Beans Co.",
      title: "Black, pinto, or dry beans",
    }),
    sample({
      id: "expired",
      brand: "Old Pasta",
      title: "Spaghetti deal",
      expiresAt: new Date(Date.now() - 86400000),
    }),
    sample({
      id: "used",
      brand: "Used Pasta",
      title: "Spaghetti deal",
      used: true,
    }),
  ];

  it("returns matching active coupons for missing items", () => {
    const deals = findDealsForMissingIngredients(
      ["Spaghetti", "Dry black beans"],
      coupons
    );
    expect(deals.map((d) => d.id).sort()).toEqual(["beans", "pasta"]);
    expect(deals.find((d) => d.id === "pasta")?.matchedIngredients).toContain(
      "Spaghetti"
    );
  });

  it("returns empty when fully stocked (no missing)", () => {
    expect(findDealsForMissingIngredients([], coupons)).toEqual([]);
  });

  it("returns empty when missing items have no coupon matches", () => {
    expect(
      findDealsForMissingIngredients(["saffron", "truffle oil"], coupons)
    ).toEqual([]);
  });

  it("skips expired and used coupons", () => {
    const deals = findDealsForMissingIngredients(["Spaghetti"], coupons);
    expect(deals.every((d) => d.id === "pasta")).toBe(true);
    expect(deals).toHaveLength(1);
  });
});
