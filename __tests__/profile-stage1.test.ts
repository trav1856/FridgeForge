import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  dbUser: null as Record<string, unknown> | null,
  pins: [] as unknown[],
  updates: [] as { where: unknown; data: unknown }[],
  selects: [] as unknown[],
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async (args: { select?: unknown }) => {
        h.selects.push(args.select);
        // Deliberately return the FULL row (private columns included) to prove the mapper drops them.
        return h.dbUser;
      }),
      update: vi.fn(async (args: { where: unknown; data: unknown }) => {
        h.updates.push(args);
        return {};
      }),
    },
    profilePin: { findMany: vi.fn(async () => h.pins), deleteMany: vi.fn(), createMany: vi.fn() },
    recipe: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    recipeFavorite: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    $transaction: vi.fn(async () => []),
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => h.user),
  getActiveHouseholdId: (u: { memberships?: { householdId: string }[] } | null) =>
    u?.memberships?.[0]?.householdId ?? null,
}));
vi.mock("@/lib/public-profile", () => ({
  getPublicProfileBySlug: vi.fn(async () => ({ badges: [], recipes: [] })),
}));

import {
  PUBLIC_PROFILE_FIELDS,
  PROFILE_USER_SELECT,
  toPublicProfileFields,
  visiblePinCards,
  validatePinsShape,
  getProfilePageData,
} from "@/lib/profile";
import {
  validateHandle,
  normalizeXUrl,
  normalizeFacebookUrl,
  isSafeSocialUrl,
  cleanText,
  BIO_MAX,
} from "@/lib/profile-fields";
import { ageOn, checkMinAge, minAge, parseBirthDate } from "@/lib/age-gate";
import { cropRect, processProfileImage, isManagedProfileImagePath, parseCropParams } from "@/lib/profile-images";
import { GET as publicGET } from "@/app/api/profiles/[handle]/route";
import { PATCH, GET as ownerGET } from "@/app/api/profile/route";
import { PUT as pinsPUT } from "@/app/api/profile/pins/route";
import { POST as imagePOST, DELETE as imageDELETE } from "@/app/api/profile/images/[kind]/route";

const PRIVATE_VALUES = {
  email: "secret-cook@example.test",
  passwordHash: "$argon2id$should-never-leak",
  allergenFlags: '["peanut_secret"]',
  isJewish: true,
  isMuslim: true,
  preferKosher: true,
  preferHalal: true,
  preferVegan: true,
  preferLowSodium: true,
  plan: "pro",
  role: "admin",
  ageConfirmedAt: new Date("2026-01-01T00:00:00Z"),
  memberships: [{ householdId: "hh-secret", household: { inviteCode: "INVITE99" } }],
  disabledReason: "nope",
};
const LEAK_RE = /secret-cook|argon2id|peanut_secret|hh-secret|INVITE99|allergen|isJewish|isMuslim|preferKosher|preferHalal|preferVegan|preferLowSodium|passwordHash|"email"|"plan"|"role"|ageConfirmed|household/i;

function fullRow(over: Record<string, unknown> = {}) {
  return {
    id: "u-owner",
    name: "Jamie R.",
    profileSlug: "jamiecooks",
    bio: "Beans and rice forever.",
    avatarUrl: "/profile-images/u/uowner-avatar-x-abc.webp",
    bannerUrl: "/profile-images/u/uowner-banner-x-abc.webp",
    socialX: "https://x.com/jamiecooks",
    socialFacebook: "https://www.facebook.com/jamiecooks",
    profilePublic: true,
    disabled: false,
    ...PRIVATE_VALUES,
    ...over,
  };
}

beforeEach(() => {
  h.user = null;
  h.dbUser = null;
  h.pins = [];
  h.updates = [];
  h.selects = [];
});

describe("public profile allow-list", () => {
  it("maps only the allowed fields, whatever the row contains", () => {
    const out = toPublicProfileFields(fullRow());
    expect(Object.keys(out).sort()).toEqual([...PUBLIC_PROFILE_FIELDS].sort());
    expect(JSON.stringify(out)).not.toMatch(LEAK_RE);
  });

  it("the profile select never loads private columns", () => {
    const keys = Object.keys(PROFILE_USER_SELECT);
    for (const k of ["email", "passwordHash", "allergenFlags", "isJewish", "isMuslim", "preferKosher", "preferHalal", "preferVegan", "plan", "role", "memberships"]) {
      expect(keys).not.toContain(k);
    }
  });

  it("drops unmanaged image paths and unsafe social URLs", () => {
    const out = toPublicProfileFields(
      fullRow({ avatarUrl: "https://evil.example/x.png", socialX: "javascript:alert(1)", socialFacebook: "https://evil.example" })
    );
    expect(out.avatarUrl).toBeNull();
    expect(out.socialX).toBeNull();
    expect(out.socialFacebook).toBeNull();
  });

  it("GET /api/profiles/[handle] JSON has no private fields (guest and other user)", async () => {
    h.dbUser = fullRow();
    for (const viewer of [null, { id: "u-other", email: "other@example.test", memberships: [] }]) {
      h.user = viewer;
      const res = await publicGET(new NextRequest("http://x/api/profiles/jamiecooks"), {
        params: Promise.resolve({ handle: "jamiecooks" }),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).not.toMatch(LEAK_RE);
      const json = JSON.parse(text);
      expect(json.kind).toBe("public");
      expect(json.isOwner).toBe(false);
      expect(json.profile.bio).toBe("Beans and rice forever.");
    }
    for (const sel of h.selects) {
      expect(Object.keys(sel as object)).not.toContain("email");
      expect(Object.keys(sel as object)).not.toContain("allergenFlags");
    }
  });

  it("a private profile returns only a stub to others, full view to the owner", async () => {
    h.dbUser = fullRow({ profilePublic: false });
    h.user = null;
    const stub = await getProfilePageData("jamiecooks", { userId: null, householdId: null });
    expect(stub).toEqual({ kind: "private", isOwner: false, handle: "jamiecooks" });
    h.user = { id: "u-other", email: "o@x.test", memberships: [] };
    const res = await publicGET(new NextRequest("http://x/api/profiles/jamiecooks"), {
      params: Promise.resolve({ handle: "jamiecooks" }),
    });
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ kind: "private", isOwner: false, handle: "jamiecooks" });
    expect(text).not.toMatch(/Beans and rice|profile-images|x\.com/);
    const own = await getProfilePageData("jamiecooks", { userId: "u-owner", householdId: null });
    expect(own?.kind).toBe("public");
    expect(own && own.kind === "public" && own.isOwner && own.isPrivate).toBe(true);
  });

  it("disabled or unknown users 404", async () => {
    h.dbUser = fullRow({ disabled: true });
    expect(await getProfilePageData("jamiecooks", { userId: null, householdId: null })).toBeNull();
    h.dbUser = null;
    expect(await getProfilePageData("nobody", { userId: null, householdId: null })).toBeNull();
  });
});

describe("pins visibility", () => {
  const recipe = (over: Record<string, unknown>) => ({
    id: "r",
    title: "T",
    imageUrl: null,
    cookTimeMinutes: 20,
    servings: 2,
    visibility: "global",
    householdId: "hh-owner",
    ownerUserId: "u-owner",
    shares: [],
    owner: { name: "Jamie R.", profileSlug: "jamiecooks", profilePublic: true, disabled: false },
    ...over,
  });
  const pins = [
    { kind: "own", position: 1, recipe: recipe({ id: "own-global" }) },
    { kind: "own", position: 2, recipe: recipe({ id: "own-household", visibility: "household" }) },
    { kind: "own", position: 3, recipe: recipe({ id: "not-mine", ownerUserId: "u-x" }) },
    { kind: "favorite", position: 1, recipe: recipe({ id: "fav-sam", ownerUserId: "u-sam", householdId: "hh-sam", owner: { name: "Sam K.", profileSlug: "samk", profilePublic: true, disabled: false } }) },
    { kind: "favorite", position: 2, recipe: recipe({ id: "fav-private-author", ownerUserId: "u-pat", householdId: "hh-pat", owner: { name: "Pat", profileSlug: "pat", profilePublic: false, disabled: false } }) },
    { kind: "favorite", position: 3, recipe: recipe({ id: "fav-catalog", ownerUserId: null, householdId: null, owner: null }) },
    { kind: "favorite", position: 4, recipe: recipe({ id: "fav-own", ownerUserId: "u-owner" }) },
  ];

  it("outsiders only see public/shared pins; owner sees household pins too", () => {
    const guest = visiblePinCards(pins as never, "u-owner", { userId: null, householdId: null });
    expect(guest.own.map((c) => c.id)).toEqual(["own-global"]);
    const owner = visiblePinCards(pins as never, "u-owner", { userId: "u-owner", householdId: "hh-owner" });
    expect(owner.own.map((c) => c.id)).toEqual(["own-global", "own-household"]);
  });

  it("favorites are by other cooks, credit the author, and only link public authors", () => {
    const v = visiblePinCards(pins as never, "u-owner", { userId: null, householdId: null });
    expect(v.favorite.map((c) => c.id)).toEqual(["fav-sam", "fav-private-author", "fav-catalog"]);
    expect(v.favorite[0]!.author).toEqual({ displayName: "Sam K.", handle: "samk" });
    expect(v.favorite[1]!.author).toEqual({ displayName: "Pat", handle: null });
    expect(v.favorite[2]!.author).toEqual({ displayName: "FridgeForge kitchen", handle: null });
  });

  it("validates pin payload shape", () => {
    expect(validatePinsShape({ own: ["a", "b", "c"], favorite: [] }).ok).toBe(true);
    expect(validatePinsShape({ own: ["a", "b", "c", "d"] }).ok).toBe(false);
    expect(validatePinsShape({ own: ["a", "a"] }).ok).toBe(false);
    expect(validatePinsShape({ own: "a" }).ok).toBe(false);
    expect(validatePinsShape({ favorite: [1] }).ok).toBe(false);
  });
});

describe("owner-only writes", () => {
  const json = (url: string, method: string, body: unknown) =>
    new NextRequest(url, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

  it("guests get 401 on every write and on the owner GET", async () => {
    h.user = null;
    expect((await ownerGET()).status).toBe(401);
    expect((await PATCH(json("http://x/api/profile", "PATCH", { bio: "hi" }))).status).toBe(401);
    expect((await pinsPUT(json("http://x/api/profile/pins", "PUT", { own: [] }))).status).toBe(401);
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" }));
    expect((await imagePOST(new NextRequest("http://x/api/profile/images/avatar", { method: "POST", body: fd }), { params: Promise.resolve({ kind: "avatar" }) })).status).toBe(401);
    expect((await imageDELETE(new NextRequest("http://x/api/profile/images/avatar", { method: "DELETE" }), { params: Promise.resolve({ kind: "avatar" }) })).status).toBe(401);
    expect(h.updates).toHaveLength(0);
  });

  it("a signed-in user can't target another account: extra id fields are rejected, writes hit only their own row", async () => {
    h.user = { id: "u-me", profileSlug: "me-cook", ageConfirmedAt: new Date(), memberships: [] };
    for (const body of [{ userId: "u-owner", bio: "pwned" }, { id: "u-owner" }, { profileSlug: "jamiecooks" }, { email: "x@y.z" }]) {
      const res = await PATCH(json("http://x/api/profile", "PATCH", body));
      expect(res.status).toBe(400);
    }
    expect((await pinsPUT(json("http://x/api/profile/pins", "PUT", { own: [], userId: "u-owner" }))).status).toBe(400);
    expect(h.updates).toHaveLength(0);
    await PATCH(json("http://x/api/profile", "PATCH", { bio: "mine" }));
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]!.where).toEqual({ id: "u-me" });
  });

  it("requires a date of birth before the first profile save, and blocks under-13s", async () => {
    h.user = { id: "u-new", profileSlug: "newcook", ageConfirmedAt: null, memberships: [] };
    const missing = await PATCH(json("http://x/api/profile", "PATCH", { bio: "hi" }));
    expect(missing.status).toBe(403);
    const young = new Date();
    const dob = `${young.getUTCFullYear() - 10}-01-01`;
    const under = await PATCH(json("http://x/api/profile", "PATCH", { bio: "hi", birthDate: dob }));
    expect(under.status).toBe(403);
    expect((await under.json()).code).toBe("UNDER_MIN_AGE");
    expect(under.headers.get("set-cookie")).toMatch(/ff_age_block=1/);
    expect(h.updates).toHaveLength(0);
    const ok = await PATCH(json("http://x/api/profile", "PATCH", { bio: "hi", birthDate: "1990-05-05" }));
    expect(ok.status).toBe(200);
    const data = h.updates[0]!.data as Record<string, unknown>;
    expect(data.ageConfirmedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(data)).not.toContain("1990");
  });
});

describe("field validation", () => {
  it("handles", () => {
    expect(validateHandle("@Jamie-Cooks")).toEqual({ ok: true, value: "jamie-cooks" });
    expect(validateHandle("ab").ok).toBe(false);
    expect(validateHandle("admin").ok).toBe(false);
    expect(validateHandle("bad_handle").ok).toBe(false);
    expect(validateHandle("a".repeat(31)).ok).toBe(false);
  });
  it("social links normalize to https and reject other hosts/schemes", () => {
    expect(normalizeXUrl("@jamie_c")).toEqual({ ok: true, value: "https://x.com/jamie_c" });
    expect(normalizeXUrl("https://twitter.com/jamie_c?s=20")).toEqual({ ok: true, value: "https://x.com/jamie_c" });
    expect(normalizeXUrl("")).toEqual({ ok: true, value: null });
    expect(normalizeXUrl("javascript:alert(1)").ok).toBe(false);
    expect(normalizeXUrl("https://evil.example/jamie").ok).toBe(false);
    expect(normalizeFacebookUrl("facebook.com/jamie.cooks")).toEqual({ ok: true, value: "https://www.facebook.com/jamie.cooks" });
    expect(normalizeFacebookUrl("https://m.facebook.com/profile.php?id=123")).toEqual({ ok: true, value: "https://www.facebook.com/profile.php?id=123" });
    expect(normalizeFacebookUrl("https://facebook.com.evil.example/x").ok).toBe(false);
    expect(normalizeFacebookUrl("javascript://facebook.com/x").ok).toBe(false);
    expect(isSafeSocialUrl("https://x.com/a")).toBe(true);
    expect(isSafeSocialUrl("http://x.com/a")).toBe(false);
  });
  it("bio limit", () => {
    expect(cleanText("x".repeat(BIO_MAX), BIO_MAX).ok).toBe(true);
    expect(cleanText("x".repeat(BIO_MAX + 1), BIO_MAX).ok).toBe(false);
    expect(cleanText("   ", BIO_MAX)).toEqual({ ok: true, value: null });
  });
});

describe("age gate", () => {
  const today = new Date("2026-10-12T12:00:00Z");
  it("computes whole years and the 13th-birthday boundary", () => {
    expect(ageOn(parseBirthDate("2013-10-12")!, today)).toBe(13);
    expect(ageOn(parseBirthDate("2013-10-13")!, today)).toBe(12);
    expect(checkMinAge("2013-10-12", today).ok).toBe(true);
    const r = checkMinAge("2013-10-13", today);
    expect(r.ok === false && r.code).toBe("UNDER_MIN_AGE");
    expect(checkMinAge("2013-02-30", today).ok).toBe(false);
    expect(checkMinAge(undefined, today).ok).toBe(false);
    expect(checkMinAge("1890-01-01", today).ok).toBe(false);
  });
  it("FF_MIN_AGE can raise but never lower the floor", () => {
    expect(minAge(undefined)).toBe(13);
    expect(minAge("10")).toBe(13);
    expect(minAge("16")).toBe(16);
  });
});

describe("profile images", () => {
  it("cropRect keeps the aspect inside the image", () => {
    expect(cropRect(1000, 500, 1, { zoom: 1, focusX: 0.5, focusY: 0.5 })).toEqual({ left: 250, top: 0, width: 500, height: 500 });
    expect(cropRect(1200, 1200, 3, { zoom: 1, focusX: 0.5, focusY: 0 })).toEqual({ left: 0, top: 0, width: 1200, height: 400 });
    const z = cropRect(1000, 1000, 1, { zoom: 2, focusX: 1, focusY: 1 });
    expect(z).toEqual({ left: 500, top: 500, width: 500, height: 500 });
    expect(parseCropParams((k) => ({ zoom: "9", focusX: "-1", focusY: "abc" })[k])).toEqual({ zoom: 3, focusX: 0, focusY: 0.5 });
  });

  it("re-encodes to WebP at the target size and strips EXIF/GPS", async () => {
    const jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 200, g: 120, b: 40 } } })
      .withExif({
        IFD0: { Artist: "Secret Person", Copyright: "GPS test" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "36/1 9/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "95/1 59/1 0/1" },
      })
      .jpeg()
      .toBuffer();
    const inMeta = await sharp(jpeg).metadata();
    expect(inMeta.exif).toBeDefined();
    const avatar = await processProfileImage(jpeg, "avatar", { zoom: 1, focusX: 0.5, focusY: 0.5 });
    const am = await sharp(avatar).metadata();
    expect(am.format).toBe("webp");
    expect([am.width, am.height]).toEqual([400, 400]);
    expect(am.exif).toBeUndefined();
    expect(am.xmp).toBeUndefined();
    expect(avatar.includes(Buffer.from("Secret Person"))).toBe(false);
    const banner = await processProfileImage(jpeg, "banner", { zoom: 1, focusX: 0.5, focusY: 0.5 });
    const bm = await sharp(banner).metadata();
    expect([bm.width, bm.height]).toEqual([1500, 500]);
  });

  it("rejects non-images, GIFs, tiny and oversize files", async () => {
    await expect(processProfileImage(Buffer.from("<svg onload=alert(1)>"), "avatar", { zoom: 1, focusX: 0.5, focusY: 0.5 })).rejects.toThrow();
    const gif = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#fff" } }).gif().toBuffer();
    await expect(processProfileImage(gif, "avatar", { zoom: 1, focusX: 0.5, focusY: 0.5 })).rejects.toThrow(/JPEG, PNG or WebP/);
    const tiny = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(processProfileImage(tiny, "avatar", { zoom: 1, focusX: 0.5, focusY: 0.5 })).rejects.toThrow(/too small/);
    await expect(processProfileImage(Buffer.alloc(8 * 1024 * 1024 + 1), "banner", { zoom: 1, focusX: 0.5, focusY: 0.5 })).rejects.toThrow(/8MB/);
  });

  it("only manages its own paths", () => {
    expect(isManagedProfileImagePath("/profile-images/u/abc-avatar-1-ff.webp")).toBe(true);
    expect(isManagedProfileImagePath("/profile-images/u/../../etc/passwd")).toBe(false);
    expect(isManagedProfileImagePath("/recipe-images/user/a.jpg")).toBe(false);
  });
});
