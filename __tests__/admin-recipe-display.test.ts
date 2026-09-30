import { describe, expect, it } from "vitest";
import {
  ADMIN_FLAG_KEYS,
  activeAdminFlags,
  formatAdminDate,
  formatAdminDateTime,
  formatIngredientLine,
  formatMinutes,
  formatQuantity,
  ownerDisplay,
} from "@/lib/admin-recipe-display";
import { originLabel } from "@/lib/recipe-taxonomy";

describe("admin recipe display helpers", () => {
  it("covers every admin-toggleable flag exactly once", () => {
    expect(new Set(ADMIN_FLAG_KEYS).size).toBe(ADMIN_FLAG_KEYS.length);
    expect(ADMIN_FLAG_KEYS).toHaveLength(11);
  });

  it("lists active flags in group order with human labels", () => {
    const flags = activeAdminFlags({
      lowSodiumEligible: true,
      isStruggleMeal: true,
      kosherEligible: true,
      veganEligible: false,
    });
    expect(flags.map((f) => f.label)).toEqual([
      "Struggle meal",
      "Kosher*",
      "Low sodium",
    ]);
  });

  it("formats dates deterministically in UTC", () => {
    expect(formatAdminDate("2026-09-28T06:44:00.000Z")).toBe("Sep 28, 2026");
    expect(formatAdminDateTime("2026-01-02T03:04:00.000Z")).toBe(
      "Jan 2, 2026 03:04 UTC"
    );
    expect(formatAdminDate(null)).toBe("—");
    expect(formatAdminDate("garbage")).toBe("—");
  });

  it("formats quantities and ingredient lines", () => {
    expect(formatQuantity(0.5)).toBe("½");
    expect(formatQuantity(1.25)).toBe("1¼");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(1 / 3)).toBe("⅓");
    expect(formatQuantity(1.4)).toBe("1.4");
    expect(formatIngredientLine({ name: "eggs", quantity: 3, unit: "each" })).toBe(
      "3 eggs"
    );
    expect(formatIngredientLine({ name: "flour", quantity: 2, unit: "cup" })).toBe(
      "2 cup flour"
    );
  });

  it("labels origins and owners for humans", () => {
    expect(originLabel("ashkenazi-jewish")).toBe("Ashkenazi Jewish");
    expect(originLabel("some-legacy_id")).toBe("Some Legacy Id");
    expect(ownerDisplay(null)).toBe("Shared catalog");
    expect(ownerDisplay({ name: "", email: "a@b.c" })).toBe("a@b.c");
    expect(formatMinutes(95)).toBe("1 h 35 min");
    expect(formatMinutes(null)).toBe("—");
  });
});

import {
  ADAPT_NOTE_FIELDS,
  ADAPT_NOTE_MAX,
  adaptNoteError,
  adaptNotesPatch,
  normalizeAdaptNote,
} from "@/lib/admin-recipe-display";

describe("adapt note helpers", () => {
  it("covers all four adapt note fields", () => {
    expect(ADAPT_NOTE_FIELDS.map((f) => f.key)).toEqual([
      "kosherAdaptNote",
      "halalAdaptNote",
      "veganAdaptNote",
      "vegetarianAdaptNote",
    ]);
  });

  it("normalizes: undefined untouched, blank → null, text trimmed", () => {
    expect(normalizeAdaptNote(undefined)).toBeUndefined();
    expect(normalizeAdaptNote(null)).toBeNull();
    expect(normalizeAdaptNote("   \n ")).toBeNull();
    expect(normalizeAdaptNote("  Use halal beef.  ")).toBe("Use halal beef.");
  });

  it("validates length after trimming", () => {
    expect(adaptNoteError("x".repeat(ADAPT_NOTE_MAX))).toBeNull();
    expect(adaptNoteError(`  ${"x".repeat(ADAPT_NOTE_MAX)}  `)).toBeNull();
    expect(adaptNoteError("x".repeat(ADAPT_NOTE_MAX + 1))).toMatch(/500/);
  });

  it("patches only notes whose normalized value changed", () => {
    const initial = {
      kosherAdaptNote: "Keep meat and dairy separate.",
      halalAdaptNote: null,
      veganAdaptNote: "Swap dairy.",
      vegetarianAdaptNote: null,
    };
    expect(
      adaptNotesPatch(initial, {
        kosherAdaptNote: "  Keep meat and dairy separate. ",
        halalAdaptNote: "  Omit mirin. ",
        veganAdaptNote: "   ",
        vegetarianAdaptNote: "",
      })
    ).toEqual({ halalAdaptNote: "Omit mirin.", veganAdaptNote: null });
    expect(adaptNotesPatch(initial, {})).toEqual({});
  });
});
