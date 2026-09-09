import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  householdWhere,
  recipeRowMatchesScope,
  recipeScopeWhere,
  rowMatchesScope,
} from "@/lib/household";
import { canAccessLiveCoupons } from "@/lib/edition";

describe("generateInviteCode", () => {
  it("returns 8-char unambiguous codes", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });

  it("respects custom length", () => {
    expect(generateInviteCode(6)).toHaveLength(6);
  });

  it("produces varied output across calls", () => {
    const set = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(set.size).toBeGreaterThan(1);
  });
});

describe("household scoping helpers", () => {
  it("householdWhere passes through null for guest CE", () => {
    expect(householdWhere(null)).toEqual({ householdId: null });
  });

  it("householdWhere keeps exact household for pantry", () => {
    expect(householdWhere("hh1")).toEqual({ householdId: "hh1" });
  });

  it("rowMatchesScope keeps guest rows only for guests", () => {
    expect(rowMatchesScope(null, null)).toBe(true);
    expect(rowMatchesScope("hh1", null)).toBe(false);
    expect(rowMatchesScope("hh1", "hh1")).toBe(true);
    expect(rowMatchesScope(null, "hh1")).toBe(false);
  });

  it("recipeScopeWhere: guests see shared/null only", () => {
    expect(recipeScopeWhere(null)).toEqual({ householdId: null });
  });

  it("recipeScopeWhere: signed-in includes null shared recipes OR household", () => {
    expect(recipeScopeWhere("hh1")).toEqual({
      OR: [{ householdId: null }, { householdId: "hh1" }],
    });
  });

  it("recipeRowMatchesScope allows shared catalog for everyone", () => {
    expect(recipeRowMatchesScope(null, null)).toBe(true);
    expect(recipeRowMatchesScope(null, "hh1")).toBe(true);
    expect(recipeRowMatchesScope("hh1", "hh1")).toBe(true);
    expect(recipeRowMatchesScope("hh1", null)).toBe(false);
    expect(recipeRowMatchesScope("hh2", "hh1")).toBe(false);
  });
});

describe("edition gate", () => {
  it("only pro can access live coupons", () => {
    expect(canAccessLiveCoupons(null)).toBe(false);
    expect(canAccessLiveCoupons({ plan: "community" } as never)).toBe(false);
    expect(canAccessLiveCoupons({ plan: "pro" } as never)).toBe(true);
  });
});
