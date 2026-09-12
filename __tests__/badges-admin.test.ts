import { describe, expect, it } from "vitest";
import {
  BADGE_IMAGE_MAX_BYTES,
  isManagedBadgeImagePath,
  validateBadgeImageUpload,
} from "@/lib/badge-images";
import { slugifyBadgeTitle } from "@/lib/badges-shared";

describe("validateBadgeImageUpload", () => {
  it("accepts jpeg/png/webp/gif under size limit", () => {
    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]) {
      const r = validateBadgeImageUpload({ mime, size: 1024 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.ext).toMatch(/^\.(jpg|png|webp|gif)$/);
    }
  });

  it("rejects wrong type and oversize", () => {
    expect(
      validateBadgeImageUpload({ mime: "application/pdf", size: 10 }).ok
    ).toBe(false);
    expect(
      validateBadgeImageUpload({
        mime: "image/png",
        size: BADGE_IMAGE_MAX_BYTES + 1,
      }).ok
    ).toBe(false);
    expect(validateBadgeImageUpload({ mime: "image/png", size: 0 }).ok).toBe(
      false
    );
  });
});

describe("isManagedBadgeImagePath", () => {
  it("only allows local /badge-images/ filenames", () => {
    expect(isManagedBadgeImagePath("/badge-images/abc.jpg")).toBe(true);
    expect(isManagedBadgeImagePath("/badge-images/../etc/passwd")).toBe(false);
    expect(isManagedBadgeImagePath("https://evil/x.jpg")).toBe(false);
    expect(isManagedBadgeImagePath(null)).toBe(false);
  });
});

describe("slugifyBadgeTitle", () => {
  it("slugifies and falls back", () => {
    expect(slugifyBadgeTitle("Kitchen Hero!")).toBe("kitchen-hero");
    expect(slugifyBadgeTitle("!!!")).toBe("badge");
  });
});
