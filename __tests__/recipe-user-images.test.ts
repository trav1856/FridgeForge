import { describe, expect, it } from "vitest";
import {
  RECIPE_USER_IMAGE_MAX_BYTES,
  canEditRecipeImage,
  isManagedRecipeUserImagePath,
  validateRecipeUserImageUpload,
} from "@/lib/recipe-user-images";

describe("validateRecipeUserImageUpload", () => {
  it("accepts jpeg/png/webp/gif under size limit", () => {
    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]) {
      const r = validateRecipeUserImageUpload({ mime, size: 1024 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.ext).toMatch(/^\.(jpg|png|webp|gif)$/);
    }
  });

  it("rejects wrong type and oversize", () => {
    expect(
      validateRecipeUserImageUpload({ mime: "application/pdf", size: 10 }).ok
    ).toBe(false);
    expect(
      validateRecipeUserImageUpload({
        mime: "image/png",
        size: RECIPE_USER_IMAGE_MAX_BYTES + 1,
      }).ok
    ).toBe(false);
    expect(
      validateRecipeUserImageUpload({ mime: "image/png", size: 0 }).ok
    ).toBe(false);
  });
});

describe("isManagedRecipeUserImagePath", () => {
  it("only allows local /recipe-images/user/ filenames", () => {
    expect(isManagedRecipeUserImagePath("/recipe-images/user/abc.jpg")).toBe(
      true
    );
    expect(
      isManagedRecipeUserImagePath("/recipe-images/user/../etc/passwd")
    ).toBe(false);
    expect(isManagedRecipeUserImagePath("/recipe-images/banana-bread.jpg")).toBe(
      false
    );
    expect(isManagedRecipeUserImagePath("https://evil/x.jpg")).toBe(false);
    expect(isManagedRecipeUserImagePath(null)).toBe(false);
  });
});

describe("canEditRecipeImage", () => {
  const recipeOwned = {
    ownerUserId: "u1",
    householdId: "h1",
  };
  const recipeHousehold = {
    ownerUserId: "other",
    householdId: "h1",
  };
  const recipeCatalog = {
    ownerUserId: null,
    householdId: null,
  };

  it("allows owner and household members", () => {
    expect(
      canEditRecipeImage(recipeOwned, { userId: "u1", householdId: "h1" })
    ).toBe(true);
    expect(
      canEditRecipeImage(recipeHousehold, { userId: "u2", householdId: "h1" })
    ).toBe(true);
  });

  it("denies other households and unsigned members on foreign recipes", () => {
    expect(
      canEditRecipeImage(recipeOwned, { userId: "u9", householdId: "h9" })
    ).toBe(false);
    expect(
      canEditRecipeImage(recipeHousehold, {
        userId: "u2",
        householdId: "h-other",
      })
    ).toBe(false);
  });

  it("allows guests only on guest/catalog-scoped (null household) recipes", () => {
    expect(
      canEditRecipeImage(recipeCatalog, { userId: null, householdId: null })
    ).toBe(true);
    expect(
      canEditRecipeImage(recipeOwned, { userId: null, householdId: null })
    ).toBe(false);
  });

  it("does not let signed-in household members edit pure catalog rows", () => {
    expect(
      canEditRecipeImage(recipeCatalog, { userId: "u1", householdId: "h1" })
    ).toBe(false);
  });
});
