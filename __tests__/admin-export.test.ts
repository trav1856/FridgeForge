import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { createHash } from "crypto";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

// ---- tiny fake Postgres: rows per table + the WHERE forms the exporter uses ----
const h = vi.hoisted(() => {
  const D = new Date("2026-10-01T00:00:00Z");
  const T: Record<string, Record<string, unknown>[]> = {
    User: [
      { id: "u1", email: "alice@example.com", name: "Alice", passwordHash: "HASH-SECRET-1", role: "user", createdAt: D, updatedAt: D },
      { id: "u2", email: "bob@example.com", name: "Bob", passwordHash: "HASH-SECRET-2", role: "user", createdAt: D, updatedAt: D },
    ],
    Session: [{ id: "s1", userId: "u1", token: "SESSION-SECRET-TOKEN", createdAt: D, expiresAt: D }],
    PasswordResetToken: [{ id: "p1", userId: "u1", tokenHash: "RESET-SECRET-HASH", createdById: "u2", createdAt: D, expiresAt: D }],
    Household: [{ id: "h1", name: "Alice & Bob kitchen", inviteCode: "INVITE-SECRET", createdAt: D, updatedAt: D }],
    HouseholdMember: [
      { id: "m1", householdId: "h1", userId: "u1", role: "owner", createdAt: D },
      { id: "m2", householdId: "h1", userId: "u2", role: "member", createdAt: D },
    ],
    PantryItem: [{ id: "pi1", name: "Bob's milk", householdId: "h1", imageUrl: null, createdAt: D, updatedAt: D }],
    Recipe: [
      { id: "r1", title: "Public bread", visibility: "global", ownerUserId: "u1", householdId: null, imageUrl: "/recipe-images/banana-bread.jpg", createdAt: D, updatedAt: D },
      { id: "r2", title: "Family stew", visibility: "household", ownerUserId: "u1", householdId: "h1", imageUrl: null, createdAt: D, updatedAt: D },
    ],
    RecipeIngredient: [
      { id: "i1", recipeId: "r1", name: "flour" },
      { id: "i2", recipeId: "r2", name: "beef" },
    ],
    RecipeReview: [{ id: "rv1", recipeId: "r1", userId: "u2", stars: 5, body: "bob comment", createdAt: D, updatedAt: D }],
    HowToBadge: [{ id: "b1", slug: "knife", title: "Knife skills", createdAt: D, updatedAt: D }],
    SharedProduct: [{ id: "sp1", barcode: "036000291452", name: "Crackers", createdByUserId: "u1", createdByHouseholdId: "h1", imageUrl: null, createdAt: D, updatedAt: D }],
  };
  function evalWhere(row: Record<string, unknown>, where: string, params: unknown[]) {
    return where.split(" OR ").some((c) => {
      let m = c.match(/^"(\w+)" = \$(\d+)$/);
      if (m) return row[m[1]] === params[+m[2] - 1];
      m = c.match(/^"(\w+)" = ANY\(\$(\d+)\)$/);
      if (m) return (params[+m[2] - 1] as unknown[]).includes(row[m[1]]);
      m = c.match(/^lower\("(\w+)"\) = lower\(\$(\d+)\)$/);
      if (m) return String(row[m[1]] ?? "").toLowerCase() === String(params[+m[2] - 1]).toLowerCase();
      m = c.match(/^"(\w+)" IN \((.+)\)$/);
      if (m) return m[2].split(",").map((x) => x.trim().replace(/'/g, "")).includes(String(row[m[1]]));
      throw new Error("unhandled where " + c);
    });
  }
  const prisma = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes("_prisma_migrations")) return [{ migration_name: "20261013233000_export_jobs" }];
      if (sql.includes("server_version")) return [{ v: "18.6" }];
      const t = sql.match(/FROM "(\w+)"/)![1];
      const w = sql.match(/ WHERE (.+?)( ORDER BY|$)/)?.[1];
      return (T[t] ?? []).filter((r) => !w || evalWhere(r, w, params));
    }),
    user: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => T.User.find((u) => u.id === where.id) ?? null) },
    householdMember: { findMany: vi.fn(async ({ where }: { where: { userId: string } }) => T.HouseholdMember.filter((m) => m.userId === where.userId)) },
    recipe: { findMany: vi.fn(async () => T.Recipe.filter((r) => r.ownerUserId === "u1" || r.householdId === "h1")) },
  };
  return { prisma, T };
});
vi.mock("@/lib/db", () => ({ prisma: h.prisma }));

const auth = vi.hoisted(() => ({ user: null as null | { id: string; role: string; disabled: boolean } }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  getCurrentUser: async () => auth.user,
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const tmp = mkdtempSync(path.join(os.tmpdir(), "ff-export-"));
process.env.FF_EXPORT_DIR = tmp;
process.env.FF_GIT_COMMIT = "abc123";
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

import { buildExportZip, pgEnvFromUrl } from "@/lib/export/build";
import { redactedColumnsFor, listTables, toCsv } from "@/lib/export/tables";
import { RESTORE_SH, CONTENT_IMPORT_SCRIPT } from "@/lib/export/docs";
import { GET as listGET, POST as createPOST } from "@/app/api/admin/export/route";
import { GET as downloadGET } from "@/app/api/admin/export/download/route";
import { POST as linkPOST } from "@/app/api/admin/export/[id]/link/route";

type Entries = Map<string, Buffer>;
async function readZip(file: string, password?: string): Promise<Entries> {
  const zip = await import("@zip.js/zip.js");
  zip.configure({ useWebWorkers: false });
  const r = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(readFileSync(file))), password ? { password } : {});
  const out: Entries = new Map();
  for (const e of await r.getEntries()) {
    if (e.directory) continue;
    out.set(e.filename, Buffer.from(await e.getData!(new zip.Uint8ArrayWriter())));
  }
  await r.close();
  return out;
}
const SECRETS = ["HASH-SECRET", "SESSION-SECRET-TOKEN", "RESET-SECRET-HASH", "INVITE-SECRET"];
function checkManifest(z: Entries) {
  const m = JSON.parse(z.get("MANIFEST.json")!.toString());
  for (const f of m.files) {
    const b = z.get(f.path);
    expect(b, f.path).toBeDefined();
    expect(createHash("sha256").update(b!).digest("hex"), f.path).toBe(f.sha256);
    expect(b!.length).toBe(f.bytes);
  }
  const listed = new Set(m.files.map((f: { path: string }) => f.path));
  for (const k of z.keys()) if (k !== "MANIFEST.json") expect(listed.has(k), k).toBe(true);
  return m;
}

let userZip: Entries, contentZip: Entries, userManifest: { rowCounts: Record<string, number> }, contentSha: string;
beforeAll(async () => {
  const u = await buildExportZip({ jobId: "jobuser", kind: "user", targetUserId: "u1" });
  userZip = await readZip(u.file);
  const c = await buildExportZip({ jobId: "jobcontent", kind: "content" });
  contentZip = await readZip(c.file);
  contentSha = c.manifestSha256;
  userManifest = JSON.parse(userZip.get("MANIFEST.json")!.toString());
});

describe("redaction rules", () => {
  it("credential columns never go into CSV/JSON copies", () => {
    const t = Object.fromEntries(listTables().map((x) => [x.model, x]));
    expect(redactedColumnsFor(t.User)).toContain("passwordHash");
    expect(redactedColumnsFor(t.Session)).toContain("token");
    expect(redactedColumnsFor(t.PasswordResetToken)).toContain("tokenHash");
    expect(redactedColumnsFor(t.Household)).toContain("inviteCode");
    expect(redactedColumnsFor(t.ExportJob)).toContain("linkTokenHash");
  });
  it("CSV quotes commas, quotes, newlines and formula-looking cells", () => {
    expect(toCsv(["a", "b"], [{ a: 'x,"y"', b: "=1+1" }])).toBe('a,b\r\n"x,""y""","=1+1"\r\n');
  });
  it("pg_dump gets the password via env, not argv; scripts carry no credentials", () => {
    const env = pgEnvFromUrl("postgresql://app:s3cr%40t@db.example:5432/ff?schema=public");
    expect(env).toMatchObject({ PGHOST: "db.example", PGUSER: "app", PGPASSWORD: "s3cr@t", PGDATABASE: "ff" });
    for (const s of [RESTORE_SH, CONTENT_IMPORT_SCRIPT]) {
      expect(s).not.toMatch(/postgres(ql)?:\/\/[^\s"'`]*:[^\s"'`]*@/);
      expect(s).not.toMatch(/PGPASSWORD=\S/);
    }
  });
});

describe("user export", () => {
  it("manifest checksums match every file", () => {
    checkManifest(userZip);
  });
  it("no secrets, no db dump, has the household note", () => {
    const all = [...userZip.values()].map((b) => b.toString()).join("\n");
    for (const s of SECRETS) expect(all).not.toContain(s);
    expect([...userZip.keys()].some((k) => k.endsWith(".dump"))).toBe(false);
    expect(userZip.get("README.md")!.toString()).toMatch(/may contain entries created by other household members/);
  });
  it("includes the user's profile, recipes, household pantry; not other users' profiles", () => {
    expect(JSON.parse(userZip.get("data/User.json")!.toString()).map((u: { id: string }) => u.id)).toEqual(["u1"]);
    expect(userManifest.rowCounts.Recipe).toBe(2);
    expect(userManifest.rowCounts.PantryItem).toBe(1);
    expect(userManifest.rowCounts.RecipeIngredient).toBe(2);
    expect(userZip.get("data/User.json")!.toString()).not.toContain("bob@example.com");
  });
});

describe("content export", () => {
  it("manifest checksums match and the hash returned is the manifest's", () => {
    checkManifest(contentZip);
    expect(createHash("sha256").update(contentZip.get("MANIFEST.json")!).digest("hex")).toBe(contentSha);
  });
  it("has no PII: no users, emails, households, pantries, reviews or ids of people", () => {
    const keys = [...contentZip.keys()];
    expect(keys.some((k) => /\/(User|Session|Household|HouseholdMember|PantryItem|RecipeReview|PasswordResetToken)\./.test(k))).toBe(false);
    const all = [...contentZip.values()].map((b) => b.toString("latin1")).join("\n");
    expect(all).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    for (const s of ["u1\"", "u2\"", "h1\"", "Alice", "Bob", "bob comment", ...SECRETS]) expect(all).not.toContain(s);
    const recipes = JSON.parse(contentZip.get("content/Recipe.json")!.toString());
    expect(recipes.map((r: { id: string }) => r.id)).toEqual(["r1"]);
    expect(recipes[0].ownerUserId).toBeNull();
    const sp = JSON.parse(contentZip.get("content/SharedProduct.json")!.toString());
    expect(sp[0].createdByUserId).toBeNull();
    expect(sp[0].createdByHouseholdId).toBeNull();
    expect(keys).toContain("uploads/recipe-images/banana-bread.jpg");
    expect(keys).toContain("import-content.mjs");
  });
});

describe("encryption", () => {
  it("an encrypted zip can't be read without the password", async () => {
    const r = await buildExportZip({ jobId: "jobenc", kind: "content", password: "correct horse 1" });
    await expect(readZip(r.file)).rejects.toThrow();
    await expect(readZip(r.file, "wrong password")).rejects.toThrow();
    const ok = await readZip(r.file, "correct horse 1");
    checkManifest(ok);
    expect(JSON.parse(ok.get("MANIFEST.json")!.toString()).encryption).toMatch(/AES-256/);
    expect(readFileSync(r.file).includes(Buffer.from("Public bread"))).toBe(false);
  });
});

describe("admin only", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new NextRequest("http://x/api/admin/export", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
  it("guests get 401 and signed-in non-admins get 403 on every export route", async () => {
    for (const [u, code] of [[null, 401], [{ id: "u1", role: "user", disabled: false }, 403]] as const) {
      auth.user = u;
      expect((await listGET()).status).toBe(code);
      expect((await createPOST(post({ kind: "full" }))).status).toBe(code);
      expect((await linkPOST(new NextRequest("http://x", { method: "POST" }), { params: Promise.resolve({ id: "j" }) })).status).toBe(code);
      expect((await downloadGET(new NextRequest("http://x/api/admin/export/download?token=abc"))).status).toBe(code);
    }
  });
  it("cross-site POSTs are blocked even for admins", async () => {
    auth.user = { id: "a1", role: "admin", disabled: false };
    expect((await createPOST(post({ kind: "full" }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });
});

describe("one build at a time", () => {
  it("two simultaneous starts: one runs, the other gets 429", async () => {
    const jobs: Record<string, unknown>[] = [];
    Object.assign(h.prisma, {
      exportJob: {
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => jobs.filter((j) => j.status === "running").length),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const j = { id: `j${jobs.length}`, createdAt: new Date(), ...data }; jobs.push(j); return j; }),
        update: vi.fn(async () => ({})),
      },
      adminAuditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(h.prisma)),
    });
    const { startExport, ExportError } = await import("@/lib/export/jobs");
    const rs = await Promise.allSettled([
      startExport({ actorId: "a1", kind: "content" }),
      startExport({ actorId: "a1", kind: "content" }),
    ]);
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rej = rs.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rej.reason).toBeInstanceOf(ExportError);
    expect(rej.reason.status).toBe(429);
    await new Promise((r) => setTimeout(r, 200));
  });
});
