import { describe, expect, it } from "vitest";
import { isAdmin, adminBootstrapEmails, DEFAULT_ADMIN_EMAILS } from "@/lib/admin";
import {
  REVIEW_BODY_MAX,
  validateRecipeReview,
} from "@/lib/recipe-review";

describe("admin gate", () => {
  it("isAdmin only when role === admin", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin({ role: "user" })).toBe(false);
    expect(isAdmin({ role: "member" })).toBe(false);
    expect(isAdmin({ role: "admin" })).toBe(true);
  });

  it("bootstrap emails include known owner and FF_ADMIN_EMAILS", () => {
    const prev = process.env.FF_ADMIN_EMAILS;
    process.env.FF_ADMIN_EMAILS = "aron@example.com, Trav1856@gmail.com ";
    try {
      const list = adminBootstrapEmails();
      expect(list).toContain("trav1856@gmail.com");
      expect(list).toContain("aron@example.com");
      for (const e of DEFAULT_ADMIN_EMAILS) {
        expect(list).toContain(e.toLowerCase());
      }
    } finally {
      if (prev === undefined) delete process.env.FF_ADMIN_EMAILS;
      else process.env.FF_ADMIN_EMAILS = prev;
    }
  });
});

describe("recipe review validation", () => {
  it("accepts stars 1–5 and body ≤180", () => {
    expect(validateRecipeReview(5, "Great")).toEqual({
      ok: true,
      stars: 5,
      body: "Great",
    });
    expect(validateRecipeReview(1, "")).toEqual({
      ok: true,
      stars: 1,
      body: "",
    });
    const max = "x".repeat(REVIEW_BODY_MAX);
    expect(validateRecipeReview(3, max)).toEqual({
      ok: true,
      stars: 3,
      body: max,
    });
  });

  it("rejects stars outside 1–5", () => {
    expect(validateRecipeReview(0, "ok").ok).toBe(false);
    expect(validateRecipeReview(6, "ok").ok).toBe(false);
    expect(validateRecipeReview(3.5, "ok").ok).toBe(false);
    expect(validateRecipeReview("nope", "ok").ok).toBe(false);
    expect(validateRecipeReview(null, "ok").ok).toBe(false);
  });

  it("rejects body over 180 characters", () => {
    const tooLong = "y".repeat(REVIEW_BODY_MAX + 1);
    const result = validateRecipeReview(4, tooLong);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/180/);
    }
  });

  it("trims body whitespace", () => {
    expect(validateRecipeReview(2, "  hi  ")).toEqual({
      ok: true,
      stars: 2,
      body: "hi",
    });
  });
});
