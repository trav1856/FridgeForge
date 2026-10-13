import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import {
  allocateRandomHandle,
  defaultProfileSlugBase,
  isAutoSlugFromEmail,
  isValidProfileSlug,
  randomHandle,
} from "@/lib/profile-slug";
import { validateHandle } from "@/lib/profile-fields";

const tmp = mkdtempSync(path.join(os.tmpdir(), "ff-rimg-"));
vi.mock("@/lib/recipe-user-images", () => ({ recipeUserImagesDir: () => tmp }));
import { GET as recipeImageGET } from "@/app/recipe-images/user/[file]/route";
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("random handles", () => {
  it("look like cook-xxxxxx, are valid, not reserved, and never contain the email", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const h = randomHandle();
      expect(h).toMatch(/^cook-[a-z2-9]{6}$/);
      expect(isValidProfileSlug(h)).toBe(true);
      expect(validateHandle(h)).toEqual({ ok: true, value: h });
      seen.add(h);
    }
    expect(seen.size).toBeGreaterThan(295);
  });
  it("allocation skips taken handles", async () => {
    let n = 0;
    const seq = (k: number) => Buffer.from(Array.from({ length: k }, () => (n < 6 ? 0 : 5)).map((x) => { n++; return x; }));
    const first = randomHandle(() => Buffer.alloc(6, 0));
    const h = await allocateRandomHandle(async (c) => c === first, seq);
    expect(h).not.toBe(first);
    expect(h).toMatch(/^cook-/);
  });
});

describe("isAutoSlugFromEmail (never-customized rule)", () => {
  it("matches the old allocator's outputs", () => {
    expect(isAutoSlugFromEmail("trav1856", "trav1856@gmail.com")).toBe(true);
    expect(isAutoSlugFromEmail("trav1856-2", "trav1856@gmail.com")).toBe(true);
    expect(isAutoSlugFromEmail("pro", "pro@fridgeforge.local")).toBe(true);
    expect(isAutoSlugFromEmail("demo-test-123", "demo-test+123@fridgeforge.local")).toBe(true);
    expect(isAutoSlugFromEmail("demo-test", "demo-test+123@fridgeforge.local")).toBe(true);
    expect(isAutoSlugFromEmail("chef-sam", "a@x.com", "Chef Sam")).toBe(true); // name fallback for a 1-char local part
    expect(defaultProfileSlugBase("a@x.com", "Chef Sam")).toBe("chef-sam");
  });
  it("leaves customized and random handles alone", () => {
    expect(isAutoSlugFromEmail("jamiecooks", "trav1856@gmail.com")).toBe(false);
    expect(isAutoSlugFromEmail("trav1856-cooks", "trav1856@gmail.com")).toBe(false);
    expect(isAutoSlugFromEmail("trav1856-1", "trav1856@gmail.com")).toBe(false);
    expect(isAutoSlugFromEmail("cook-7k3f9q", "trav1856@gmail.com")).toBe(false);
    expect(isAutoSlugFromEmail(null, "trav1856@gmail.com")).toBe(false);
  });
});

describe("signup + lazy repair never derive from email", () => {
  const h = vi.hoisted(() => ({ updated: [] as unknown[] }));
  vi.mock("@/lib/db", () => ({
    prisma: {
      user: {
        findUnique: vi.fn(async () => null),
        update: vi.fn(async (a: unknown) => { h.updated.push(a); return {}; }),
      },
    },
  }));
  beforeEach(() => { h.updated = []; });
  it("allocateProfileSlugForCreate returns a random handle", async () => {
    const { allocateProfileSlugForCreate } = await import("@/lib/public-profile");
    const s = await allocateProfileSlugForCreate("trav1856@gmail.com", "Trav");
    expect(s).toMatch(/^cook-[a-z2-9]{6}$/);
  });
  it("ensureUserProfileSlug replaces an email-derived slug and keeps a custom one", async () => {
    const { ensureUserProfileSlug } = await import("@/lib/public-profile");
    const s = await ensureUserProfileSlug({ id: "u1", email: "trav1856@gmail.com", name: null, profileSlug: "trav1856" });
    expect(s).toMatch(/^cook-/);
    expect(h.updated).toHaveLength(1);
    const keep = await ensureUserProfileSlug({ id: "u2", email: "trav1856@gmail.com", name: null, profileSlug: "jamiecooks" });
    expect(keep).toBe("jamiecooks");
    expect(h.updated).toHaveLength(1);
  });
});

describe("/recipe-images/user/[file] route", () => {
  const get = (file: string) =>
    recipeImageGET(new NextRequest(`http://x/recipe-images/user/${file}`), { params: Promise.resolve({ file }) });
  it("serves uploads written after startup with the right type", async () => {
    writeFileSync(path.join(tmp, "abc-123.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
    const r = await get("abc-123.jpg");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("404s for missing files, odd names and non-image extensions", async () => {
    writeFileSync(path.join(tmp, "evil.svg"), "<svg/>");
    for (const f of ["nope.jpg", "evil.svg", "..%2F.env", "../x.jpg", "a b.jpg"]) {
      expect((await get(f)).status).toBe(404);
    }
  });
});
