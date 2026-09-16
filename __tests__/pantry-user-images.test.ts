import { describe, expect, it } from "vitest";
import {
  PANTRY_USER_IMAGE_MAX_BYTES,
  canEditPantryItemImage,
  isManagedPantryUserImagePath,
  validatePantryUserImageUpload,
} from "@/lib/pantry-user-images";
import { isUserPantryImage } from "@/lib/pantry-images";

describe("validatePantryUserImageUpload", () => {
  it("accepts jpeg/png/webp/gif under size limit", () => {
    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]) {
      const r = validatePantryUserImageUpload({ mime, size: 1024 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.ext).toMatch(/^\.(jpg|png|webp|gif)$/);
    }
  });

  it("rejects wrong type and oversize", () => {
    expect(
      validatePantryUserImageUpload({ mime: "application/pdf", size: 10 }).ok
    ).toBe(false);
    expect(
      validatePantryUserImageUpload({
        mime: "image/png",
        size: PANTRY_USER_IMAGE_MAX_BYTES + 1,
      }).ok
    ).toBe(false);
    expect(
      validatePantryUserImageUpload({ mime: "image/png", size: 0 }).ok
    ).toBe(false);
  });
});

describe("isManagedPantryUserImagePath / isUserPantryImage", () => {
  it("only allows local /pantry-images/user/ filenames", () => {
    expect(isManagedPantryUserImagePath("/pantry-images/user/abc.jpg")).toBe(
      true
    );
    expect(isUserPantryImage("/pantry-images/user/abc.jpg")).toBe(true);
    expect(
      isManagedPantryUserImagePath("/pantry-images/user/../etc/passwd")
    ).toBe(false);
    expect(isManagedPantryUserImagePath("/pantry-images/generic/milk.webp")).toBe(
      false
    );
    expect(isManagedPantryUserImagePath("https://evil/x.jpg")).toBe(false);
    expect(isManagedPantryUserImagePath(null)).toBe(false);
  });
});

describe("canEditPantryItemImage", () => {
  it("allows matching household scope", () => {
    expect(
      canEditPantryItemImage(
        { householdId: "h1" },
        { householdId: "h1" }
      )
    ).toBe(true);
    expect(
      canEditPantryItemImage(
        { householdId: null },
        { householdId: null }
      )
    ).toBe(true);
  });

  it("denies cross-household and guest vs owned", () => {
    expect(
      canEditPantryItemImage(
        { householdId: "h1" },
        { householdId: "h9" }
      )
    ).toBe(false);
    expect(
      canEditPantryItemImage(
        { householdId: "h1" },
        { householdId: null }
      )
    ).toBe(false);
    expect(
      canEditPantryItemImage(
        { householdId: null },
        { householdId: "h1" }
      )
    ).toBe(false);
  });
});
