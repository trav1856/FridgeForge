import { describe, expect, it } from "vitest";
import {
  activeFilterChips,
  buildUserOrderBy,
  buildUserWhere,
  DEFAULT_USER_LIST_PARAMS,
  pageWindow,
  parseUserListParams,
  USER_SEARCH_FIELDS,
  userListHref,
} from "@/lib/admin-user-query";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("parseUserListParams", () => {
  it("defaults: no filters, last-active sort desc, page 1", () => {
    expect(parseUserListParams({})).toEqual(DEFAULT_USER_LIST_PARAMS);
    expect(DEFAULT_USER_LIST_PARAMS.sort).toBe("active");
  });

  it("whitelists enum values and drops junk", () => {
    const p = parseUserListParams({
      role: "superuser",
      plan: "pro",
      status: "suspended",
      active: "45",
      sort: "password",
      dir: "sideways",
      page: "-3",
    });
    expect(p.role).toBe("");
    expect(p.plan).toBe("pro");
    expect(p.status).toBe("suspended");
    expect(p.active).toBe("");
    expect(p.sort).toBe("active");
    expect(p.dir).toBe("desc");
    expect(p.page).toBe(1);
  });

  it("trims and caps the search, takes the first of repeated params", () => {
    const p = parseUserListParams({ q: ["  Rosa  ", "ignored"], page: "4" });
    expect(p.q).toBe("Rosa");
    expect(p.page).toBe(4);
    expect(parseUserListParams({ q: "x".repeat(500) }).q).toHaveLength(120);
  });

  it("custom signed-up range keeps valid dates only; presets drop from/to", () => {
    expect(parseUserListParams({ signedUp: "custom", from: "2026-01-01", to: "nope" })).toMatchObject({
      signedUp: "custom",
      from: "2026-01-01",
      to: "",
    });
    expect(parseUserListParams({ signedUp: "custom" }).signedUp).toBe("");
    expect(parseUserListParams({ signedUp: "30", from: "2026-01-01" })).toMatchObject({ signedUp: "30", from: "" });
  });

  it("name/email sorts default ascending", () => {
    expect(parseUserListParams({ sort: "name" }).dir).toBe("asc");
    expect(parseUserListParams({ sort: "recipes" }).dir).toBe("desc");
  });
});

describe("buildUserWhere", () => {
  it("empty params → match all", () => {
    expect(buildUserWhere(DEFAULT_USER_LIST_PARAMS, NOW)).toEqual({});
  });

  it("search is case-insensitive OR over name + email (postal code joins later)", () => {
    expect(USER_SEARCH_FIELDS).toEqual(["name", "email"]);
    const w = buildUserWhere({ ...DEFAULT_USER_LIST_PARAMS, q: "ROSA" }, NOW);
    expect(w).toEqual({
      AND: [
        {
          OR: [
            { name: { contains: "ROSA", mode: "insensitive" } },
            { email: { contains: "ROSA", mode: "insensitive" } },
          ],
        },
      ],
    });
  });

  it("role, plan and status filters", () => {
    const w = buildUserWhere({ ...DEFAULT_USER_LIST_PARAMS, role: "admin", plan: "pro", status: "suspended" }, NOW);
    expect(w.AND).toEqual([{ role: "admin" }, { plan: "pro" }, { disabled: true }]);
    const a = buildUserWhere({ ...DEFAULT_USER_LIST_PARAMS, status: "active" }, NOW);
    expect(a.AND).toEqual([{ disabled: false }]);
  });

  it("last active windows and never", () => {
    const w7 = buildUserWhere({ ...DEFAULT_USER_LIST_PARAMS, active: "7" }, NOW);
    expect(w7.AND).toEqual([{ lastActiveAt: { gte: new Date(NOW.getTime() - 7 * DAY) } }]);
    const w90 = buildUserWhere({ ...DEFAULT_USER_LIST_PARAMS, active: "90" }, NOW);
    expect(w90.AND).toEqual([{ lastActiveAt: { gte: new Date(NOW.getTime() - 90 * DAY) } }]);
    const never = buildUserWhere({ ...DEFAULT_USER_LIST_PARAMS, active: "never" }, NOW);
    expect(never.AND).toEqual([{ lastActiveAt: null }]);
  });

  it("signed-up preset and inclusive custom range", () => {
    const p30 = buildUserWhere({ ...DEFAULT_USER_LIST_PARAMS, signedUp: "30" }, NOW);
    expect(p30.AND).toEqual([{ createdAt: { gte: new Date(NOW.getTime() - 30 * DAY) } }]);
    const custom = buildUserWhere(
      { ...DEFAULT_USER_LIST_PARAMS, signedUp: "custom", from: "2026-09-01", to: "2026-09-30" },
      NOW
    );
    expect(custom.AND).toEqual([
      {
        createdAt: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lt: new Date("2026-10-01T00:00:00.000Z"),
        },
      },
    ]);
    const openEnded = buildUserWhere({ ...DEFAULT_USER_LIST_PARAMS, signedUp: "custom", from: "", to: "2026-09-30" }, NOW);
    expect(openEnded.AND).toEqual([{ createdAt: { lt: new Date("2026-10-01T00:00:00.000Z") } }]);
  });

  it("combines everything with AND", () => {
    const p = parseUserListParams({ q: "web", role: "user", plan: "pro", active: "30", status: "active", signedUp: "90" });
    const w = buildUserWhere(p, NOW);
    expect(w.AND).toHaveLength(6);
  });
});

describe("buildUserOrderBy", () => {
  it("last active puts never-active users last and tie-breaks on id", () => {
    expect(buildUserOrderBy({ sort: "active", dir: "desc" })).toEqual([
      { lastActiveAt: { sort: "desc", nulls: "last" } },
      { id: "desc" },
    ]);
  });
  it("recipes sorts by relation count", () => {
    expect(buildUserOrderBy({ sort: "recipes", dir: "asc" })[0]).toEqual({ ownedRecipes: { _count: "asc" } });
  });
  it("created / email", () => {
    expect(buildUserOrderBy({ sort: "created", dir: "asc" })[0]).toEqual({ createdAt: "asc" });
    expect(buildUserOrderBy({ sort: "email", dir: "asc" })[0]).toEqual({ email: "asc" });
  });
});

describe("paging + hrefs", () => {
  it("pageWindow clamps and computes ranges", () => {
    expect(pageWindow(0, 1, 25)).toMatchObject({ pageCount: 1, page: 1, skip: 0, from: 0, to: 0 });
    expect(pageWindow(60, 3, 25)).toMatchObject({ pageCount: 3, page: 3, skip: 50, take: 25, from: 51, to: 60 });
    expect(pageWindow(60, 99, 25)).toMatchObject({ page: 3 });
  });

  it("filters live in the URL; defaults are omitted", () => {
    expect(userListHref(DEFAULT_USER_LIST_PARAMS)).toBe("/admin/users");
    const p = parseUserListParams({ q: "a b", plan: "pro", active: "30", sort: "name" });
    expect(userListHref(p)).toBe("/admin/users?q=a+b&plan=pro&active=30&sort=name");
    expect(userListHref(p, { page: 2 })).toContain("page=2");
    // round trip
    const back = parseUserListParams(Object.fromEntries(new URLSearchParams(userListHref(p).split("?")[1])));
    expect(back).toEqual(p);
  });

  it("chips remove one filter each and reset paging", () => {
    const p = parseUserListParams({ plan: "pro", active: "30", page: "3" });
    const chips = activeFilterChips(p);
    expect(chips.map((c) => c.label)).toEqual(["Plan: Premium", "Last active: 30 days"]);
    expect(chips[0]!.href).toBe("/admin/users?active=30");
    expect(chips[1]!.href).toBe("/admin/users?plan=pro");
  });
});
