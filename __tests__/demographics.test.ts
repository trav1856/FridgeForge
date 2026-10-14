import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => {
  const D = new Date("2026-10-01T00:00:00Z");
  const T: Record<string, Record<string, unknown>[]> = {
    User: [{ id: "u1", email: "one@example.com", name: "One", passwordHash: "HASH-SECRET", role: "user", createdAt: D, updatedAt: D }],
    Recipe: [{ id: "r1", title: "Tacos", cuisine: "Mexican", visibility: "global", ownerUserId: null, householdId: null, imageUrl: null, createdAt: D, updatedAt: D }],
    UserDemographics: [{ userId: "u1", sex: "female", ethnicities: '["mexican"]', originCountries: '["MX"]', researchConsent: true, consentAt: D, age16ConfirmedAt: D, createdAt: D, updatedAt: D }],
    RecipeView: [{ id: "v1", userId: "u1", recipeId: "r1", cuisine: "Mexican", day: D, views: 2, lastAt: D }],
  };
  const demo = new Map<string, Record<string, unknown>>();
  const audit: Record<string, unknown>[] = [];
  const prisma: Record<string, unknown> = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes("_prisma_migrations")) return [{ migration_name: "20261014060000_demographics" }];
      if (sql.includes("server_version")) return [{ v: "18.6" }];
      if (sql.includes('"RecipeFavorite" f')) return [];
      if (sql.includes('FROM "RecipeView" WHERE "userId" = ANY')) return [];
      const t = sql.match(/FROM "(\w+)"/)![1];
      const w = sql.match(/ WHERE (.+?)( ORDER BY|$)/)?.[1];
      const rows = T[t] ?? [];
      if (!w) return rows;
      const m = w.match(/^"(\w+)" = (?:ANY\()?\$(\d+)\)?$/);
      if (m) { const p = params[+m[2] - 1]; return rows.filter((r) => (Array.isArray(p) ? p.includes(r[m[1]]) : r[m[1]] === p)); }
      if (/"visibility"/.test(w)) return rows;
      return [];
    }),
    user: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => T.User.find((u) => u.id === where.id) ?? null) },
    householdMember: { findMany: vi.fn(async () => []) },
    recipe: { findMany: vi.fn(async () => []) },
    userDemographics: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => demo.get(where.userId) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: { userId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const prev = demo.get(where.userId);
        const row = prev ? { ...prev, ...update } : { ...create };
        demo.set(where.userId, row);
        return row;
      }),
      findMany: vi.fn(async () => []),
    },
    adminAuditLog: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { audit.push(data); return data; }) },
  };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return { prisma, T, demo, audit };
});
vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
type U = { id: string; role: string; disabled: boolean } | null;
const auth = vi.hoisted(() => ({ user: null as U }));
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getCurrentUser: async () => auth.user }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

const tmp = mkdtempSync(path.join(os.tmpdir(), "ff-demo-"));
process.env.FF_EXPORT_DIR = tmp;
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

import { CONSENT_TEXT, K_ANON, cleanCountries, cleanEthnicities, cleanSex, isResearchEligible, regionForCountry } from "@/lib/demographics/options";
import { buildReport, type CohortMember, type Activity } from "@/lib/demographics/analytics";
import { summaryCsv, summaryPdf } from "@/lib/demographics/summary";
import { isAtLeast16, saveDemographics } from "@/lib/demographics/store";
import { rankTaste } from "@/lib/demographics/taste";
import { buildExportZip, CONTENT_MODELS } from "@/lib/export/build";
import { listTables } from "@/lib/export/tables";
import { GET as demoGET, PUT as demoPUT } from "@/app/api/account/demographics/route";
import { GET as tasteGET, DELETE as tasteDELETE } from "@/app/api/account/taste/route";
import { GET as exportGET } from "@/app/api/admin/analytics/export/route";

const ADMIN = { id: "admin1", role: "admin", disabled: false };
const USER = { id: "u2", role: "user", disabled: false };
function req(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}
beforeEach(() => { auth.user = null; h.audit.length = 0; h.demo.clear(); });

function cohort(n: number, f: (i: number) => Partial<CohortMember> = () => ({})): CohortMember[] {
  return Array.from({ length: n }, (_, i) => ({ userId: `user-${i}`, sex: "female", ethnicities: [], countries: [], regions: [], ...f(i) }));
}

describe("options + validation", () => {
  it("consent text is exact", () => {
    expect(CONSENT_TEXT).toBe("We may share or sell anonymized, aggregated insights (never your name, email, or anything that identifies you) with partners for scientific and marketing research.");
    expect(K_ANON).toBe(20);
  });
  it("sex is male/female/blank only; lists are allow-listed and de-duplicated", () => {
    expect(cleanSex("male")).toBe("male");
    expect(cleanSex("other")).toBeNull();
    expect(cleanSex("")).toBeNull();
    expect(cleanEthnicities(["mexican", "mexican", "bogus", "jewish"])).toEqual(["jewish", "mexican"].sort());
    expect(cleanCountries(["MX", "XX", "IT"])).toEqual(["IT", "MX"]);
    expect(cleanCountries(Array.from({ length: 40 }, () => "MX"))).toEqual(["MX"]);
    expect(regionForCountry("IT")).toBeTruthy();
  });
  it("research eligibility needs consent AND a 16+ confirmation", () => {
    expect(isResearchEligible({ researchConsent: true, age16ConfirmedAt: new Date() })).toBe(true);
    expect(isResearchEligible({ researchConsent: true, age16ConfirmedAt: null })).toBe(false);
    expect(isResearchEligible({ researchConsent: false, age16ConfirmedAt: new Date() })).toBe(false);
    expect(isResearchEligible(null)).toBe(false);
  });
  it("isAtLeast16 checks the boundary", () => {
    const today = new Date("2026-10-14T12:00:00Z");
    expect(isAtLeast16("2010-10-14", today)).toBe(true);
    expect(isAtLeast16("2010-10-15", today)).toBe(false);
    expect(isAtLeast16("nope", today)).toBeNull();
  });
});

describe("saving private details", () => {
  it("consent needs a 16+ DOB; DOB is not stored; opting out clears consent", async () => {
    await expect(saveDemographics("u9", { researchConsent: true })).rejects.toMatchObject({ status: 400 });
    await expect(saveDemographics("u9", { researchConsent: true, birthDate: "2015-01-01" })).rejects.toMatchObject({ status: 400 });
    const ok = await saveDemographics("u9", { sex: "male", ethnicities: ["italian"], originCountries: ["IT"], researchConsent: true, birthDate: "1990-01-01" });
    expect(ok).toMatchObject({ sex: "male", researchConsent: true, ageConfirmed: true });
    const row = h.demo.get("u9")!;
    expect(JSON.stringify(row)).not.toContain("1990");
    // already confirmed: no DOB needed again
    expect((await saveDemographics("u9", { researchConsent: true })).researchConsent).toBe(true);
    const out = await saveDemographics("u9", { researchConsent: false });
    expect(out).toMatchObject({ researchConsent: false, ageConfirmed: false });
    expect(h.demo.get("u9")!.consentAt).toBeNull();
  });
  it("under-16 rejection leaves nothing saved", async () => {
    await expect(saveDemographics("u8", { sex: "female", researchConsent: true, birthDate: "2014-05-05" })).rejects.toThrow(/16/);
    expect(h.demo.has("u8")).toBe(false);
  });
});

describe("API guards", () => {
  it("guests get 401 on every account route", async () => {
    expect((await demoGET()).status).toBe(401);
    expect((await demoPUT(req("/api/account/demographics", "PUT", { sex: "male" }))).status).toBe(401);
    expect((await tasteGET()).status).toBe(401);
    expect((await tasteDELETE(req("/api/account/taste", "DELETE"))).status).toBe(401);
  });
  it("cross-site writes are blocked", async () => {
    auth.user = USER;
    expect((await demoPUT(req("/api/account/demographics", "PUT", { sex: "male" }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });
  it("rejects unknown fields and bad sex", async () => {
    auth.user = USER;
    expect((await demoPUT(req("/api/account/demographics", "PUT", { sex: "other" }))).status).toBe(400);
    expect((await demoPUT(req("/api/account/demographics", "PUT", { userId: "u1" }))).status).toBe(400);
    const r = await demoPUT(req("/api/account/demographics", "PUT", { sex: "female", ethnicities: ["jewish"] }));
    expect(r.status).toBe(200);
    expect(h.demo.has("u2")).toBe(true);
  });
  it("analytics export: guest 401, non-admin 403, admin 200 + audit appended", async () => {
    expect((await exportGET(req("/api/admin/analytics/export?format=csv", "GET"))).status).toBe(401);
    auth.user = USER;
    expect((await exportGET(req("/api/admin/analytics/export?format=csv", "GET"))).status).toBe(403);
    auth.user = ADMIN;
    const r = await exportGET(req("/api/admin/analytics/export?format=csv", "GET"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/csv");
    expect(h.audit.map((a) => a.action)).toEqual(["analytics.export"]);
    const p = await exportGET(req("/api/admin/analytics/export?format=pdf", "GET"));
    expect(p.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await p.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("k-anonymity report", () => {
  const act = (ids: string[], cuisine: string, views = 1, favorites = 0): Activity[] => ids.map((userId) => ({ userId, cuisine, views, favorites }));

  it("whole cohort under k: nothing reported", () => {
    const c = cohort(19);
    const r = buildReport(c, act(c.map((x) => x.userId), "Mexican"));
    expect(r.cohortSize).toBeNull();
    expect(r.cuisines).toEqual([]);
    expect(r.dimensions.sex.groups).toEqual([]);
  });

  it("groups under k are dropped entirely; cells under k are null", () => {
    const c = cohort(30, (i) => ({ sex: i < 22 ? "female" : "male", ethnicities: i < 25 ? ["mexican"] : ["italian"], countries: ["MX"], regions: ["Latin America"] }));
    const ids = c.map((x) => x.userId);
    const a = [...act(ids.slice(0, 21), "Mexican", 2, 1), ...act(ids.slice(0, 5), "Italian", 3)];
    const r = buildReport(c, a);
    expect(r.cohortSize).toBe(30);
    expect(r.dimensions.sex.groups.map((g) => g.key)).toEqual(["female"]); // 8 males suppressed
    expect(r.dimensions.sex.suppressedGroups).toBe(1);
    const f = r.dimensions.sex.groups[0]!;
    expect(f.cells.Mexican).toEqual({ users: 21, views: 42, favoriteUsers: 21, favorites: 21 });
    expect(f.cells.Italian).toEqual({ users: null, views: null, favoriteUsers: null, favorites: null });
    expect(r.overall.Italian!.views).toBeNull();
    expect(r.dimensions.ethnicity.groups.map((g) => g.key)).toEqual(["mexican"]);
  });

  it("multi-select users count in each group they picked", () => {
    const c = cohort(20, () => ({ ethnicities: ["mexican", "jewish"] }));
    const r = buildReport(c, act(c.map((x) => x.userId), "Mexican"));
    expect(r.dimensions.ethnicity.groups.map((g) => [g.key, g.size])).toEqual([["jewish", 20], ["mexican", 20]]);
  });

  it("activity from non-cohort users is ignored", () => {
    const c = cohort(20);
    const r = buildReport(c, [...act(c.map((x) => x.userId), "Thai"), ...act(["outsider-1", "outsider-2"], "Thai", 100)]);
    expect(r.overall.Thai!.views).toBe(20);
  });

  it("CSV + PDF contain no identifiers", async () => {
    const c = cohort(25, (i) => ({ sex: "male", countries: ["IT"], regions: ["Europe"], userId: `secret-id-${i}` }));
    const r = buildReport(c, act(c.map((x) => x.userId), "Italian", 1, 1));
    const csv = summaryCsv(r);
    expect(csv).not.toMatch(/secret-id|@/);
    expect(csv).toContain("Italian");
    expect(csv.split("\r\n")[2]).toBe("section,dimension,group,group_users,cuisine,viewers,views,favoriting_users,favorites");
    const pdf = Buffer.from(await summaryPdf(r)).toString("latin1");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).not.toContain("secret-id");
  });

  it("CSV neutralises formula-looking labels", () => {
    const c = cohort(20);
    const r = buildReport(c, act(c.map((x) => x.userId), "=HYPERLINK(1)"));
    expect(summaryCsv(r)).toContain("'=HYPERLINK(1)");
  });
});

describe("my taste", () => {
  it("ranks by views + 3x favorites", () => {
    const r = rankTaste([{ cuisine: "Thai", views: 5, recipes: 2 }, { cuisine: "Mexican", views: 1, recipes: 1 }, { cuisine: null, views: 9, recipes: 9 }], [{ cuisine: "Mexican", favorites: 2 }]);
    expect(r.map((x) => x.cuisine)).toEqual(["Mexican", "Thai"]);
    expect(r[0]).toMatchObject({ views: 1, favorites: 2, score: 7 });
  });
});

describe("exports", () => {
  async function readZip(file: string) {
    const zip = await import("@zip.js/zip.js");
    zip.configure({ useWebWorkers: false });
    const r = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(readFileSync(file))));
    const out = new Map<string, string>();
    for (const e of await r.getEntries()) if (!e.directory) out.set(e.filename, Buffer.from(await e.getData!(new zip.Uint8ArrayWriter())).toString());
    await r.close();
    return out;
  }
  it("content export never includes demographics or view history", async () => {
    expect(CONTENT_MODELS).not.toContain("UserDemographics");
    expect(CONTENT_MODELS).not.toContain("RecipeView");
    const z = await readZip((await buildExportZip({ jobId: "jobc", kind: "content" })).file);
    expect([...z.keys()].some((k) => /UserDemographics|RecipeView/.test(k))).toBe(false);
    expect([...z.values()].join("\n")).not.toContain("mexican");
  });
  it("full export (every dmmf table) includes the new tables, nothing redacted away", () => {
    const t = listTables();
    const d = t.find((x) => x.model === "UserDemographics")!;
    expect(d.columns).toEqual(expect.arrayContaining(["sex", "ethnicities", "originCountries", "researchConsent"]));
    expect(t.find((x) => x.model === "RecipeView")!.columns).toEqual(expect.arrayContaining(["userId", "recipeId", "cuisine", "views"]));
  });
  it("single-user export includes that user's demographics", async () => {
    const z = await readZip((await buildExportZip({ jobId: "jobu", kind: "user", targetUserId: "u1" })).file);
    const k = [...z.keys()].find((x) => x.endsWith("UserDemographics.json"))!;
    expect(JSON.parse(z.get(k)!)[0].userId).toBe("u1");
  });
});
