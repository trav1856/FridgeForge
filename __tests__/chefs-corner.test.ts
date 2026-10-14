import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

// ---- fake DB: raw SQL for the exporter + the few Prisma calls the content libs make ----
const h = vi.hoisted(() => {
  const D = new Date("2026-10-01T00:00:00Z");
  const FUTURE = new Date("2099-01-01T00:00:00Z");
  const T: Record<string, Record<string, unknown>[]> = {
    User: [
      { id: "chef1", email: "chef@example.com", name: "Chef Ada", passwordHash: "HASH-SECRET", role: "user", isChef: true, chefCanPublish: false, createdAt: D, updatedAt: D },
      { id: "u2", email: "reader@example.com", name: "Reader", passwordHash: "HASH-SECRET-2", role: "user", isChef: false, chefCanPublish: true, createdAt: D, updatedAt: D },
    ],
    FeaturedProfile: [
      { id: "fp1", profileType: "chef", slug: "chef-ada", name: "Chef Ada", photoUrl: "/content-images/ada.webp", bio: "Bread nerd", credentials: "[]", links: "[]", youtubeUrl: null, userId: "chef1", featuredAt: D, hidden: false, createdAt: D, updatedAt: D },
      { id: "fp2", profileType: "chef", slug: "old", name: "Hidden Chef", photoUrl: null, bio: null, credentials: "[]", links: "[]", youtubeUrl: null, userId: null, featuredAt: null, hidden: true, createdAt: D, updatedAt: D },
    ],
    Recipe: [{ id: "r1", title: "Ada bread", visibility: "global", ownerUserId: "chef1", householdId: null, chefProfileId: "fp1", imageUrl: null, createdAt: D, updatedAt: D }],
    Post: [
      { id: "p1", slug: "live", title: "Live post", status: "published", publishedAt: D, coverUrl: "/content-images/cover.webp", bodyHtml: '<p>Hi</p><figure><img src="/content-images/inline.webp" alt=""></figure>', authorUserId: "chef1", profileId: "fp1", tags: "[]", relatedRecipeIds: "[]", createdAt: D, updatedAt: D },
      { id: "p2", slug: "draft", title: "Secret draft", status: "draft", publishedAt: null, coverUrl: null, bodyHtml: "<p>draft</p>", authorUserId: "chef1", profileId: "fp1", tags: "[]", relatedRecipeIds: "[]", createdAt: D, updatedAt: D },
      { id: "p3", slug: "later", title: "Scheduled post", status: "scheduled", publishedAt: FUTURE, coverUrl: null, bodyHtml: "<p>later</p>", authorUserId: "chef1", profileId: "fp1", tags: "[]", relatedRecipeIds: "[]", createdAt: D, updatedAt: D },
    ],
    FeaturedPin: [
      { id: "pin1", kind: "post", postId: "p1", profileId: null, position: 1, createdById: "chef1", createdAt: D },
      { id: "pin2", kind: "post", postId: "p2", profileId: null, position: 2, createdById: "chef1", createdAt: D },
    ],
  };
  function cond(row: Record<string, unknown>, c: string, params: unknown[]): boolean {
    c = c.trim();
    if (c.includes(" AND ")) return c.split(" AND ").every((x) => cond(row, x, params));
    if (c.includes(" OR ")) return c.split(" OR ").some((x) => cond(row, x, params));
    let m = c.match(/^"(\w+)" = \$(\d+)$/);
    if (m) return row[m[1]] === params[+m[2] - 1];
    m = c.match(/^"(\w+)" = ANY\(\$(\d+)\)$/);
    if (m) return (params[+m[2] - 1] as unknown[]).includes(row[m[1]]);
    m = c.match(/^lower\("(\w+)"\) = lower\(\$(\d+)\)$/);
    if (m) return String(row[m[1]] ?? "").toLowerCase() === String(params[+m[2] - 1]).toLowerCase();
    m = c.match(/^"(\w+)" IN \((.+)\)$/);
    if (m) return m[2].split(",").map((x) => x.trim().replace(/'/g, "")).includes(String(row[m[1]]));
    m = c.match(/^"(\w+)" = false$/);
    if (m) return row[m[1]] === false;
    m = c.match(/^"(\w+)" <= now\(\)$/);
    if (m) return row[m[1]] instanceof Date && (row[m[1]] as Date).getTime() <= Date.now();
    throw new Error("unhandled where " + c);
  }
  const audit: Record<string, unknown>[] = [];
  const postUpdates: Record<string, unknown>[] = [];
  const prisma: Record<string, unknown> = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes("_prisma_migrations")) return [{ migration_name: "20261014050000_chefs_corner" }];
      if (sql.includes("server_version")) return [{ v: "18.6" }];
      const t = sql.match(/FROM "(\w+)"/)![1];
      const w = sql.match(/ WHERE (.+?)( ORDER BY|$)/)?.[1];
      return (T[t] ?? []).filter((r) => !w || cond(r, w, params));
    }),
    user: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => T.User.find((u) => u.id === where.id) ?? null) },
    householdMember: { findMany: vi.fn(async () => []) },
    recipe: { findMany: vi.fn(async () => T.Recipe.filter((r) => r.ownerUserId === "chef1")) },
    post: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => T.Post.find((p) => p.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        postUpdates.push({ id: where.id, ...data });
        return { ...T.Post.find((p) => p.id === where.id), ...data };
      }),
    },
    adminAuditLog: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { audit.push(data); return data; }) },
  };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return { prisma, T, audit, postUpdates };
});
vi.mock("@/lib/db", () => ({ prisma: h.prisma }));

type U = { id: string; role: string; disabled: boolean; isChef?: boolean; chefCanPublish?: boolean } | null;
const auth = vi.hoisted(() => ({ user: null as U }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  getCurrentUser: async () => auth.user,
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

const tmp = mkdtempSync(path.join(os.tmpdir(), "ff-chefs-"));
process.env.FF_EXPORT_DIR = tmp;
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

import {
  canAuthorPosts, canDeletePost, canEditPost, canEditProfile, canPublishPost, canSetChefFlag, canSubmitPost, canViewPost,
  effectiveStatus, isPostLive,
} from "@/lib/content/permissions";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import { normalizeYoutubeChannel, cleanLinks } from "@/lib/content/util";
import { postAction } from "@/lib/content/posts";
import { setChefFlag, setChefCanPublish } from "@/lib/content/profiles";
import { buildExportZip, CONTENT_MODELS, UPLOAD_DIRS } from "@/lib/export/build";
import { POST as postsPOST, GET as postsGET } from "@/app/api/content/posts/route";
import { PATCH as postPATCH, DELETE as postDELETE } from "@/app/api/content/posts/[id]/route";
import { POST as actionPOST } from "@/app/api/content/posts/[id]/action/route";
import { POST as imagesPOST } from "@/app/api/content/images/route";
import { PATCH as profilePATCH } from "@/app/api/content/profile/route";
import { PATCH as usersPATCH } from "@/app/api/admin/users/route";
import { POST as chefsPOST } from "@/app/api/admin/chefs/route";
import { POST as pinsPOST } from "@/app/api/admin/pins/route";

const ADMIN = { id: "admin1", role: "admin", disabled: false };
const CHEF_PUB = { id: "chef1", role: "user", disabled: false, isChef: true, chefCanPublish: true };
const CHEF_REVIEW = { id: "chef1", role: "user", disabled: false, isChef: true, chefCanPublish: false };
const USER = { id: "u2", role: "user", disabled: false, isChef: false, chefCanPublish: true };
const own = (status: string, publishedAt: Date | null = null) => ({ authorUserId: "chef1", status, publishedAt });

function req(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  auth.user = null;
  h.audit.length = 0;
  h.postUpdates.length = 0;
});

describe("roles and permissions", () => {
  it("only admins and chef accounts can author; regular users and guests can't", () => {
    expect(canAuthorPosts(ADMIN)).toBe(true);
    expect(canAuthorPosts(CHEF_REVIEW)).toBe(true);
    expect(canAuthorPosts(USER)).toBe(false);
    expect(canAuthorPosts(null)).toBe(false);
    expect(canAuthorPosts({ ...CHEF_PUB, disabled: true })).toBe(false);
  });

  it("chef publish toggle: direct publish vs. review", () => {
    expect(canPublishPost(CHEF_PUB, own("draft"))).toBe(true);
    expect(canPublishPost(CHEF_REVIEW, own("draft"))).toBe(false);
    expect(canSubmitPost(CHEF_REVIEW, own("draft"))).toBe(true);
    expect(canPublishPost(ADMIN, own("review"))).toBe(true);
    // Not their post.
    expect(canPublishPost(CHEF_PUB, { ...own("draft"), authorUserId: "other" })).toBe(false);
    expect(canEditPost(CHEF_PUB, { ...own("draft"), authorUserId: "other" })).toBe(false);
  });

  it("chefs without publish rights can't edit or delete live posts", () => {
    const live = own("published", new Date("2026-01-01"));
    expect(canEditPost(CHEF_REVIEW, live)).toBe(false);
    expect(canDeletePost(CHEF_REVIEW, live)).toBe(false);
    expect(canEditPost(CHEF_REVIEW, own("review"))).toBe(true);
    expect(canEditPost(CHEF_PUB, live)).toBe(true);
  });

  it("only admins can set the chef flag; chefs edit only their own profile", () => {
    expect(canSetChefFlag(ADMIN)).toBe(true);
    for (const v of [CHEF_PUB, USER, null]) expect(canSetChefFlag(v)).toBe(false);
    expect(canEditProfile(CHEF_PUB, { userId: "chef1" })).toBe(true);
    expect(canEditProfile(CHEF_PUB, { userId: "someone" })).toBe(false);
    expect(canEditProfile(USER, { userId: "u2" })).toBe(false);
  });

  it("lib refuses chef flag changes from non-admins before touching the DB", async () => {
    for (const v of [CHEF_PUB, USER, null]) {
      await expect(setChefFlag(v, "u2", true)).rejects.toMatchObject({ status: 403 });
      await expect(setChefCanPublish(v, "chef1", true)).rejects.toMatchObject({ status: 403 });
    }
    expect(h.audit).toHaveLength(0);
  });
});

describe("scheduling", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  it("scheduled posts stay hidden until their time", () => {
    const later = own("scheduled", new Date("2026-10-14T13:00:00Z"));
    expect(isPostLive(later, now)).toBe(false);
    expect(canViewPost(null, later, now)).toBe(false);
    expect(canViewPost(USER, later, now)).toBe(false);
    expect(canViewPost(CHEF_PUB, later, now)).toBe(true); // author preview
    expect(canViewPost(ADMIN, later, now)).toBe(true);
    expect(effectiveStatus(later, now)).toBe("scheduled");
    const past = new Date("2026-10-14T13:00:01Z");
    expect(isPostLive(later, past)).toBe(true);
    expect(effectiveStatus(later, past)).toBe("published");
  });

  it("drafts and review posts are never public", () => {
    for (const s of ["draft", "review"]) expect(canViewPost(null, own(s, new Date(0)), now)).toBe(false);
  });

  it("publish with a future time schedules it and audits; past/none publishes now", async () => {
    const t = "2099-06-01T15:00:00.000Z";
    await postAction(ADMIN, "p2", { action: "publish", publishAt: t }, new Date("2026-10-14T00:00:00Z"));
    expect(h.postUpdates.at(-1)).toMatchObject({ status: "scheduled", publishedAt: new Date(t) });
    expect(h.audit.at(-1)).toMatchObject({ action: "post.publish", actorId: "admin1" });
    expect((h.audit.at(-1)!.details as { scheduledFor: string }).scheduledFor).toBe(t);
    await postAction(ADMIN, "p2", { action: "publish" });
    expect(h.postUpdates.at(-1)).toMatchObject({ status: "published" });
  });

  it("chef without rights can submit but not publish; unpublish is audited", async () => {
    await expect(postAction(CHEF_REVIEW, "p2", { action: "publish" })).rejects.toMatchObject({ status: 403 });
    await postAction(CHEF_REVIEW, "p2", { action: "submit" });
    expect(h.postUpdates.at(-1)).toMatchObject({ status: "review" });
    expect(h.audit).toHaveLength(0);
    await postAction(ADMIN, "p1", { action: "unpublish" });
    expect(h.audit.at(-1)).toMatchObject({ action: "post.unpublish" });
  });
});

describe("sanitization", () => {
  it("drops scripts, handlers, styles and javascript: links", () => {
    const out = sanitizePostHtml(
      `<p onclick="x()" style="color:red" class="a">Hi<script>alert(1)</script></p><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><style>p{}</style><svg><script>1</script></svg><!-- c -->`
    );
    expect(out).toBe("<p>Hi</p>bad");
  });

  it("forces safe rel on external links and keeps relative links", () => {
    const out = sanitizePostHtml(`<a href="https://example.com/x" target="_self" rel="opener">ok</a> <a href="/recipes/1">r</a>`);
    expect(out).toContain('rel="noopener nofollow ugc"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('<a href="/recipes/1">r</a>');
    expect(out).not.toContain("opener\"");
  });

  it("only our processed images survive", () => {
    const out = sanitizePostHtml(`<img src="/content-images/a1.webp" alt="x"><img src="https://evil.test/p.png"><img src="/content-images/../.env">`);
    expect(out).toBe('<img src="/content-images/a1.webp" alt="x" loading="lazy">');
  });

  it("YouTube becomes one canonical nocookie iframe; other iframes are removed", () => {
    const out = sanitizePostHtml(`<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" onload="x"></iframe><iframe src="https://evil.test/"></iframe><div data-youtube="https://youtu.be/dQw4w9WgXcQ" contenteditable="false">ph</div>`);
    expect(out.match(/<iframe/g)).toHaveLength(2);
    expect(out).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(out).not.toContain("evil");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("contenteditable");
  });

  it("is idempotent and unwraps unknown tags", () => {
    const once = sanitizePostHtml(`<section><h2>T</h2><font>x</font><iframe src="https://youtu.be/dQw4w9WgXcQ"></iframe></section>`);
    expect(sanitizePostHtml(once)).toBe(once);
    expect(once.startsWith("<h2>T</h2>x")).toBe(true);
  });

  it("profile links are http(s) only; YouTube channel must be a channel URL", () => {
    expect(cleanLinks([{ url: "javascript:alert(1)" }, { url: "example.com", label: "" }, { url: "ftp://x.y" }])).toEqual([
      { label: "example.com", url: "https://example.com/" },
    ]);
    expect(normalizeYoutubeChannel("youtube.com/@ChefAda")).toBe("https://www.youtube.com/@ChefAda");
    expect(normalizeYoutubeChannel("https://evil.test/@x")).toBeNull();
    expect(normalizeYoutubeChannel("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});

describe("guests are read-only; non-admins can't set the chef flag", () => {
  it("guest writes get 401", async () => {
    expect((await postsPOST(req("/api/content/posts", "POST", { title: "x" }))).status).toBe(401);
    expect((await postPATCH(req("/api/content/posts/p1", "PATCH", { title: "x" }), ctx("p1"))).status).toBe(401);
    expect((await postDELETE(req("/api/content/posts/p1", "DELETE"), ctx("p1"))).status).toBe(401);
    expect((await actionPOST(req("/api/content/posts/p1/action", "POST", { action: "publish" }), ctx("p1"))).status).toBe(401);
    expect((await profilePATCH(req("/api/content/profile", "PATCH", { name: "x" }))).status).toBe(401);
    expect((await imagesPOST(req("/api/content/images", "POST"))).status).toBe(401);
    expect((await usersPATCH(req("/api/admin/users", "PATCH", { id: "u2", isChef: true }))).status).toBe(401);
    expect((await chefsPOST(req("/api/admin/chefs", "POST", { name: "x" }))).status).toBe(401);
    expect((await pinsPOST(req("/api/admin/pins", "POST", { kind: "post", refId: "p1" }))).status).toBe(401);
  });

  it("guests can read the public post list", async () => {
    (h.prisma as { post: Record<string, unknown> }).post.findMany = vi.fn(async () => []);
    expect((await postsGET(req("/api/content/posts", "GET"))).status).toBe(200);
  });

  it("regular users can't write posts; regular users and chefs can't set the chef flag", async () => {
    auth.user = USER;
    expect((await postsPOST(req("/api/content/posts", "POST", { title: "x" }))).status).toBe(403);
    for (const u of [USER, CHEF_PUB]) {
      auth.user = u;
      const a = await usersPATCH(req("/api/admin/users", "PATCH", { id: u.id, isChef: true }));
      expect(a.status).toBe(403);
      const b = await usersPATCH(req("/api/admin/users", "PATCH", { id: "chef1", chefCanPublish: true }));
      expect(b.status).toBe(403);
      expect((await chefsPOST(req("/api/admin/chefs", "POST", { name: "x" }))).status).toBe(403);
      expect((await pinsPOST(req("/api/admin/pins", "POST", { kind: "post", refId: "p1" }))).status).toBe(403);
    }
    expect(h.audit).toHaveLength(0);
  });

  it("cross-site writes are blocked even for admins", async () => {
    auth.user = ADMIN;
    const r = await usersPATCH(req("/api/admin/users", "PATCH", { id: "u2", isChef: true }, { "sec-fetch-site": "cross-site" }));
    expect(r.status).toBe(403);
    auth.user = CHEF_PUB;
    expect((await postsPOST(req("/api/content/posts", "POST", { title: "x" }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });
});

describe("export inclusion", () => {
  async function readZip(file: string) {
    const zip = await import("@zip.js/zip.js");
    zip.configure({ useWebWorkers: false });
    const r = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(readFileSync(file))));
    const out = new Map<string, string>();
    for (const e of await r.getEntries()) if (!e.directory) out.set(e.filename, Buffer.from(await e.getData!(new zip.Uint8ArrayWriter())).toString());
    await r.close();
    return out;
  }

  it("lists the new tables and image folder", () => {
    for (const m of ["FeaturedProfile", "Post", "FeaturedPin"]) expect(CONTENT_MODELS).toContain(m);
    expect(UPLOAD_DIRS).toContain("content-images");
  });

  it("content export: visible chefs + live posts only, linked account removed", async () => {
    const b = await buildExportZip({ jobId: "jobc", kind: "content" });
    const z = await readZip(b.file);
    const profiles = JSON.parse(z.get("content/FeaturedProfile.json")!);
    expect(profiles.map((p: { id: string }) => p.id)).toEqual(["fp1"]);
    expect(profiles[0].userId).toBeNull();
    const posts = JSON.parse(z.get("content/Post.json")!);
    expect(posts.map((p: { id: string }) => p.id)).toEqual(["p1"]);
    expect(posts[0].authorUserId).toBeNull();
    const pins = JSON.parse(z.get("content/FeaturedPin.json")!);
    expect(pins.map((p: { id: string }) => p.id)).toEqual(["pin1"]);
    expect(pins[0].createdById).toBeNull();
    const all = [...z.values()].join("\n");
    for (const needle of ["chef@example.com", "reader@example.com", "HASH-SECRET", "Secret draft", "Scheduled post", "chef1"]) {
      expect(all.includes(needle), needle).toBe(false);
    }
    expect(z.get("import-content.mjs")).toContain('"FeaturedProfile", "Recipe"');
    expect(JSON.parse(z.get("MANIFEST.json")!).missingUploads ?? []).toBeDefined();
  });

  it("single-user export includes the chef's own profile and posts", async () => {
    const b = await buildExportZip({ jobId: "jobu", kind: "user", targetUserId: "chef1" });
    const z = await readZip(b.file);
    expect(JSON.parse(z.get("data/FeaturedProfile.json")!)[0].id).toBe("fp1");
    expect(JSON.parse(z.get("data/Post.json")!).map((p: { id: string }) => p.id).sort()).toEqual(["p1", "p2", "p3"]);
  });
});
