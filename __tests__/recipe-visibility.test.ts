import { describe, expect, it } from "vitest";
import {
  canViewRecipe,
  nextVisibility,
  normalizeVisibility,
  recipeListAccessWhere,
  visibilityLabel,
} from "@/lib/recipe-visibility";

describe("normalizeVisibility", () => {
  it("maps legacy aliases", () => {
    expect(normalizeVisibility("public")).toBe("global");
    expect(normalizeVisibility("private")).toBe("household");
    expect(normalizeVisibility("global")).toBe("global");
    expect(normalizeVisibility("shared")).toBe("shared");
  });
  it("labels and cycles Global → Household → Shared", () => {
    expect(visibilityLabel("public")).toBe("Global");
    expect(nextVisibility("global")).toBe("household");
    expect(nextVisibility("household")).toBe("shared");
    expect(nextVisibility("shared")).toBe("global");
  });
});

describe("canViewRecipe", () => {
  it("allows global catalog and global visibility", () => {
    expect(
      canViewRecipe({ householdId: null, visibility: "household" }, { householdId: null })
    ).toBe(true);
    expect(
      canViewRecipe(
        { householdId: "hh1", visibility: "global" },
        { householdId: null }
      )
    ).toBe(true);
    expect(
      canViewRecipe(
        { householdId: "hh1", visibility: "public" },
        { householdId: "hh2" }
      )
    ).toBe(true);
  });

  it("restricts household visibility", () => {
    expect(
      canViewRecipe(
        { householdId: "hh1", visibility: "household" },
        { householdId: "hh1", userId: "u1" }
      )
    ).toBe(true);
    expect(
      canViewRecipe(
        { householdId: "hh1", visibility: "household" },
        { householdId: "hh2", userId: "u2" }
      )
    ).toBe(false);
  });

  it("allows shared recipients by user or household", () => {
    const recipe = {
      householdId: "hh1",
      visibility: "shared",
      ownerUserId: "owner",
      shares: [
        { toUserId: "friend", toUserEmail: "f@x.com", toHouseholdId: null },
        { toUserId: null, toUserEmail: null, toHouseholdId: "hh9" },
      ],
    };
    expect(
      canViewRecipe(recipe, { householdId: "hh2", userId: "friend" })
    ).toBe(true);
    expect(
      canViewRecipe(recipe, {
        householdId: "hh2",
        userId: "other",
        userEmail: "f@x.com",
      })
    ).toBe(true);
    expect(
      canViewRecipe(recipe, { householdId: "hh9", userId: "x" })
    ).toBe(true);
    expect(
      canViewRecipe(recipe, { householdId: "hh2", userId: "stranger" })
    ).toBe(false);
  });
});

describe("recipeListAccessWhere", () => {
  it("guests see catalog + global", () => {
    const w = recipeListAccessWhere({ householdId: null });
    expect(w).toEqual({
      OR: [{ householdId: null }, { visibility: { in: ["global", "public"] } }],
    });
  });
});
