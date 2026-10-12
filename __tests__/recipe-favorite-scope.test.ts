import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({ user: null as unknown, hh: null as string | null, recipe: null as unknown, created: 0 }));
vi.mock("@/lib/db", () => ({
  prisma: {
    recipe: { findUnique: vi.fn(async () => h.recipe) },
    recipeFavorite: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => { h.created++; return {}; }),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {},
  getCurrentUser: vi.fn(async () => h.user),
  resolveHouseholdId: vi.fn(async () => h.hh),
}));
import { POST } from "@/app/api/recipes/[id]/favorite/route";

const call = () => POST(new NextRequest("http://x/api/recipes/r1/favorite", { method: "POST" }), { params: Promise.resolve({ id: "r1" }) });

beforeEach(() => {
  h.user = { id: "u-me", email: "me@x.test" };
  h.hh = "hh-me";
  h.created = 0;
});

describe("favorite: anything you can view", () => {
  it("guests can't favorite", async () => {
    h.user = null;
    h.recipe = { id: "r1", householdId: null, visibility: "global", ownerUserId: null, shares: [] };
    expect((await call()).status).toBe(401);
  });
  it("catalog, own household and other cooks' global recipes can be favorited", async () => {
    for (const r of [
      { householdId: null, visibility: "global", ownerUserId: null },
      { householdId: "hh-me", visibility: "household", ownerUserId: "u-me" },
      { householdId: "hh-other", visibility: "global", ownerUserId: "u-other" },
    ]) {
      h.recipe = { id: "r1", shares: [], ...r };
      expect((await call()).status).toBe(200);
    }
    expect(h.created).toBe(3);
  });
  it("another household's private recipe stays 404", async () => {
    h.recipe = { id: "r1", householdId: "hh-other", visibility: "household", ownerUserId: "u-other", shares: [] };
    expect((await call()).status).toBe(404);
    expect(h.created).toBe(0);
  });
});
