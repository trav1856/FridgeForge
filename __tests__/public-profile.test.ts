import { describe, expect, it } from "vitest";
import {
  defaultProfileSlugBase,
  isValidProfileSlug,
  slugifyProfileBase,
  uniquifySlug,
} from "@/lib/profile-slug";
import {
  pickLatestBadges,
  recipeVisibleOnPublicProfile,
} from "@/lib/public-profile";

describe("slugifyProfileBase", () => {
  it("normalizes names and emails", () => {
    expect(slugifyProfileBase("Trav Cook!")).toBe("trav-cook");
    expect(slugifyProfileBase("  Ada.Lovelace  ")).toBe("ada-lovelace");
  });
});

describe("defaultProfileSlugBase", () => {
  it("prefers email local-part", () => {
    expect(defaultProfileSlugBase("trav@example.com", "Someone")).toBe("trav");
  });
  it("falls back to name then cook", () => {
    expect(defaultProfileSlugBase("@", "Chef Sam")).toBe("chef-sam");
    expect(defaultProfileSlugBase("@", "")).toBe("cook");
  });
});

describe("uniquifySlug", () => {
  it("appends numeric suffixes when taken", () => {
    const taken = new Set(["trav", "trav-2"]);
    expect(uniquifySlug("trav", (c) => taken.has(c))).toBe("trav-3");
  });
});

describe("isValidProfileSlug", () => {
  it("rejects short or invalid", () => {
    expect(isValidProfileSlug("a")).toBe(false);
    expect(isValidProfileSlug("Trav")).toBe(false);
    expect(isValidProfileSlug("trav-cook")).toBe(true);
  });
});

describe("recipeVisibleOnPublicProfile", () => {
  const owner = "u1";
  it("shows global to guests", () => {
    expect(
      recipeVisibleOnPublicProfile(
        { ownerUserId: owner, visibility: "global", householdId: "hh1" },
        owner,
        { householdId: null }
      )
    ).toBe(true);
    expect(
      recipeVisibleOnPublicProfile(
        { ownerUserId: owner, visibility: "public", householdId: "hh1" },
        owner,
        { householdId: null }
      )
    ).toBe(true);
  });
  it("shows household only to same household", () => {
    expect(
      recipeVisibleOnPublicProfile(
        { ownerUserId: owner, visibility: "household", householdId: "hh1" },
        owner,
        { householdId: "hh1", userId: "u2" }
      )
    ).toBe(true);
    expect(
      recipeVisibleOnPublicProfile(
        { ownerUserId: owner, visibility: "household", householdId: "hh1" },
        owner,
        { householdId: "hh2", userId: "u3" }
      )
    ).toBe(false);
    expect(
      recipeVisibleOnPublicProfile(
        { ownerUserId: owner, visibility: "private", householdId: "hh1" },
        owner,
        { householdId: null }
      )
    ).toBe(false);
  });
  it("hides shared visibility on public profile", () => {
    expect(
      recipeVisibleOnPublicProfile(
        { ownerUserId: owner, visibility: "shared", householdId: "hh1" },
        owner,
        { householdId: "hh1", userId: "friend" }
      )
    ).toBe(false);
  });
  it("ignores recipes not owned by the profile user", () => {
    expect(
      recipeVisibleOnPublicProfile(
        { ownerUserId: "other", visibility: "global", householdId: null },
        owner,
        { householdId: null }
      )
    ).toBe(false);
  });
});

describe("pickLatestBadges", () => {
  it("returns up to three for the kitchen strip", () => {
    const badges = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    expect(pickLatestBadges(badges)).toEqual([
      { id: "1" },
      { id: "2" },
      { id: "3" },
    ]);
    expect(pickLatestBadges(badges, 1)).toEqual([{ id: "1" }]);
    expect(pickLatestBadges([])).toEqual([]);
  });
});
