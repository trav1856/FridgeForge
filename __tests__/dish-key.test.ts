import { describe, expect, it } from "vitest";
import { dishKeyForTitle, normalizeDishKey } from "@/lib/dish-key";
import { cookScopeKey } from "@/lib/cook-stat";

describe("normalizeDishKey", () => {
  it("slugifies titles and drops stop words", () => {
    expect(normalizeDishKey("Classic Apple Pie")).toBe("apple-pie");
    expect(normalizeDishKey("Grilled Cheese!")).toBe("grilled-cheese");
  });
});

describe("dishKeyForTitle", () => {
  it("uses staple overrides so variants share a key", () => {
    expect(dishKeyForTitle("Grilled Cheese")).toBe("grilled-cheese");
    expect(dishKeyForTitle("Tomato Basil Grilled Cheese")).toBe(
      "grilled-cheese"
    );
  });
});

describe("cookScopeKey", () => {
  it("prefers household over user", () => {
    expect(cookScopeKey("hh1", "u1")).toBe("household:hh1");
    expect(cookScopeKey(null, "u1")).toBe("user:u1");
    expect(cookScopeKey(null, null)).toBe("guest");
  });
});
