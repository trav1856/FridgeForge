import { describe, expect, it } from "vitest";
import {
  canRequestRecipe,
  recipeIsReadable,
} from "@/lib/recipe-request";

describe("recipeIsReadable", () => {
  it("shared catalog is readable to everyone", () => {
    expect(recipeIsReadable({ householdId: null }, null)).toBe(true);
    expect(recipeIsReadable({ householdId: null }, "hh1")).toBe(true);
  });

  it("household recipes readable in-scope", () => {
    expect(
      recipeIsReadable({ householdId: "hh1", visibility: "private" }, "hh1")
    ).toBe(true);
  });

  it("public recipes readable out of scope", () => {
    expect(
      recipeIsReadable({ householdId: "hh1", visibility: "public" }, "hh2")
    ).toBe(true);
    expect(
      recipeIsReadable({ householdId: "hh1", visibility: "public" }, null)
    ).toBe(true);
  });

  it("private out-of-scope not readable", () => {
    expect(
      recipeIsReadable({ householdId: "hh1", visibility: "household" }, "hh2")
    ).toBe(false);
  });
});

describe("canRequestRecipe", () => {
  const householdRecipe = {
    id: "r1",
    householdId: "hh-owner",
    ownerUserId: "owner1",
    visibility: "public",
  };

  it("requires signed-in user", () => {
    expect(canRequestRecipe(householdRecipe, null)).toBe(false);
  });

  it("hides for shared catalog", () => {
    expect(
      canRequestRecipe(
        { id: "s", householdId: null, ownerUserId: null },
        { userId: "u1", householdId: "hh1" }
      )
    ).toBe(false);
  });

  it("hides when already in requester household", () => {
    expect(
      canRequestRecipe(householdRecipe, {
        userId: "u2",
        householdId: "hh-owner",
      })
    ).toBe(false);
  });

  it("hides for owner", () => {
    expect(
      canRequestRecipe(householdRecipe, {
        userId: "owner1",
        householdId: "hh-other",
      })
    ).toBe(false);
  });

  it("allows signed-in outsider for household recipe with owner", () => {
    expect(
      canRequestRecipe(householdRecipe, {
        userId: "u2",
        householdId: "hh-other",
      })
    ).toBe(true);
  });

  it("allows outsider with no household yet", () => {
    expect(
      canRequestRecipe(householdRecipe, {
        userId: "u2",
        householdId: null,
      })
    ).toBe(true);
  });
});
