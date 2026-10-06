/**
 * Security hotfix: ownership / scope enforcement on [id] routes and the
 * "no guest writes" rule for pantry, staples, coupons, bulk and cooking.
 * Prisma and the session lookup are mocked; route handlers run for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, unknown> & { id: string };

const h = vi.hoisted(() => {
  const tables: Record<string, Map<string, Record<string, unknown>>> = {};
  const model = (name: string) => {
    tables[name] = new Map();
    const t = tables[name]!;
    return {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => t.get(where.id) ?? null),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [...t.values()]),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...t.get(where.id)!, ...data };
        t.set(where.id, row);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = t.get(where.id);
        t.delete(where.id);
        return row;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "new", ...data })),
      upsert: vi.fn(async () => ({ cookCount: 1 })),
    };
  };
  const prisma = {
    pantryItem: model("pantryItem"),
    coupon: model("coupon"),
    shoppingListItem: model("shoppingListItem"),
    customPantryStaple: model("customPantryStaple"),
    recipe: model("recipe"),
    recipeCookSession: model("recipeCookSession"),
    recipeCookStat: model("recipeCookStat"),
  };
  const state: { user: unknown } = { user: null };
  return { prisma, tables, state };
});

vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/auth", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...orig,
    getCurrentUser: vi.fn(async () => h.state.user),
    resolveHouseholdId: vi.fn(async () =>
      orig.getActiveHouseholdId(h.state.user as never)
    ),
  };
});

import * as pantryItemRoute from "@/app/api/pantry/[id]/route";
import * as pantryRoute from "@/app/api/pantry/route";
import * as pantryBulkRoute from "@/app/api/pantry/bulk/route";
import * as pantryImageRoute from "@/app/api/pantry/[id]/image/route";
import * as staplesRoute from "@/app/api/pantry/staples/route";
import * as stapleItemRoute from "@/app/api/pantry/staples/[id]/route";
import * as couponsRoute from "@/app/api/coupons/route";
import * as couponItemRoute from "@/app/api/coupons/[id]/route";
import * as shoppingItemRoute from "@/app/api/shopping-list/[id]/route";
import * as cookRoute from "@/app/api/recipes/[id]/cook/route";
import * as recipeItemRoute from "@/app/api/recipes/[id]/route";
import { decideWriteScope } from "@/lib/write-scope";
import { getActiveHouseholdId } from "@/lib/auth";
import { personalKitchenName, shoppingRowMatchesScope } from "@/lib/household";

function member(userId: string, householdId: string) {
  return {
    id: userId,
    email: `${userId}@example.test`,
    memberships: [
      {
        id: `m-${userId}`,
        role: "owner",
        householdId,
        createdAt: new Date("2026-01-01"),
        household: { id: householdId, name: "HH", inviteCode: "ABCDEFGH" },
      },
    ],
  };
}
const userNoHousehold = { id: "u-none", email: "none@example.test", memberships: [] };

function seed(table: string, rows: Row[]) {
  const t = h.tables[table]!;
  t.clear();
  for (const r of rows) t.set(r.id, { ...r });
}
const stamps = { createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), expiresAt: null, usedAt: null, terms: null };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/x", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.state.user = null;
  seed("pantryItem", [
    { id: "p-shared", name: "Eggs", quantity: 12, unit: "each", tags: "[]", ...stamps, householdId: null },
    { id: "p-h1", name: "Milk", quantity: 1, unit: "gal", tags: "[]", ...stamps, householdId: "h1" },
    { id: "p-h2", name: "Chips", quantity: 1, unit: "bag", tags: "[]", ...stamps, householdId: "h2" },
  ]);
  seed("coupon", [
    { id: "c-shared", brand: "B", title: "T", discountText: "1", codeValue: "X", codeType: "qr", clipped: false, used: false, ...stamps, householdId: null },
    { id: "c-h1", brand: "B", title: "T", discountText: "1", codeValue: "Y", codeType: "qr", clipped: false, used: false, ...stamps, householdId: "h1" },
    { id: "c-h2", brand: "B", title: "T", discountText: "1", codeValue: "Z", codeType: "qr", clipped: false, used: false, ...stamps, householdId: "h2" },
  ]);
  seed("shoppingListItem", [
    { id: "s-guest", name: "a", householdId: null, userId: null },
    { id: "s-h1", name: "b", householdId: "h1", userId: "u1" },
    { id: "s-h2", name: "c", householdId: "h2", userId: "u2" },
    { id: "s-u-none", name: "d", householdId: null, userId: "u-none" },
  ]);
  seed("customPantryStaple", [
    { id: "st-shared", name: "x", category: "Other", hidden: false, householdId: null },
    { id: "st-h2", name: "y", category: "Other", hidden: false, householdId: "h2" },
  ]);
  seed("recipe", [
    { id: "r-catalog", householdId: null, ownerUserId: null },
    { id: "r-h1", householdId: "h1", ownerUserId: "u1" },
  ]);
});

describe("pantry/[id] PATCH + DELETE", () => {
  it("guests get 401 on shared and household rows; nothing changes", async () => {
    for (const id of ["p-shared", "p-h1"]) {
      expect((await pantryItemRoute.DELETE(req("DELETE"), ctx(id))).status).toBe(401);
      expect((await pantryItemRoute.PATCH(req("PATCH", { quantity: 0 }), ctx(id))).status).toBe(401);
    }
    expect(h.prisma.pantryItem.delete).not.toHaveBeenCalled();
    expect(h.prisma.pantryItem.update).not.toHaveBeenCalled();
    const body = await (await pantryItemRoute.DELETE(req("DELETE"), ctx("p-shared"))).json();
    expect(body.error).toMatch(/sign in to save your pantry/i);
  });

  it("signed-in user without a household gets 401", async () => {
    h.state.user = userNoHousehold;
    expect((await pantryItemRoute.DELETE(req("DELETE"), ctx("p-shared"))).status).toBe(401);
  });

  it("member gets 404 for another household's row and for shared rows", async () => {
    h.state.user = member("u1", "h1");
    for (const id of ["p-h2", "p-shared", "missing"]) {
      expect((await pantryItemRoute.DELETE(req("DELETE"), ctx(id))).status).toBe(404);
      expect((await pantryItemRoute.PATCH(req("PATCH", { quantity: 9 }), ctx(id))).status).toBe(404);
    }
    expect(h.prisma.pantryItem.delete).not.toHaveBeenCalled();
    expect(h.prisma.pantryItem.update).not.toHaveBeenCalled();
    expect(h.tables.pantryItem!.get("p-h2")!.quantity).toBe(1);
  });

  it("member can edit and delete their own row", async () => {
    h.state.user = member("u1", "h1");
    expect((await pantryItemRoute.PATCH(req("PATCH", { quantity: 3 }), ctx("p-h1"))).status).toBe(200);
    expect((await pantryItemRoute.DELETE(req("DELETE"), ctx("p-h1"))).status).toBe(200);
    expect(h.tables.pantryItem!.has("p-h1")).toBe(false);
  });
});

describe("pantry/[id]/image", () => {
  it("guests 401; other household 404", async () => {
    expect((await pantryImageRoute.DELETE(req("DELETE"), ctx("p-shared"))).status).toBe(401);
    h.state.user = member("u1", "h1");
    expect((await pantryImageRoute.DELETE(req("DELETE"), ctx("p-h2"))).status).toBe(404);
    expect(h.prisma.pantryItem.update).not.toHaveBeenCalled();
  });
});

describe("guest writes are blocked (401)", () => {
  it("pantry POST, bulk, staples, coupons POST, cook POST/DELETE", async () => {
    const r1 = await pantryRoute.POST(req("POST", { name: "Oats", quantity: 1, unit: "cups" }));
    const r2 = await pantryBulkRoute.POST(req("POST", { items: [{ name: "Oats" }] }));
    const r3 = await staplesRoute.POST(req("POST", { name: "Thing", category: "Other" }));
    const r4 = await stapleItemRoute.PATCH(req("PATCH", { hidden: true }), ctx("st-shared"));
    const r5 = await stapleItemRoute.DELETE(req("DELETE"), ctx("st-shared"));
    const r6 = await couponsRoute.POST(req("POST", { brand: "b", title: "t", discountText: "d", codeValue: "c" }));
    const r7 = await cookRoute.POST(req("POST"), ctx("r-catalog"));
    const r8 = await cookRoute.DELETE(req("DELETE"), ctx("r-catalog"));
    for (const r of [r1, r2, r3, r4, r5, r6, r7, r8]) expect(r.status).toBe(401);
    expect(h.prisma.pantryItem.create).not.toHaveBeenCalled();
    expect(h.prisma.pantryItem.update).not.toHaveBeenCalled();
    expect(h.prisma.coupon.create).not.toHaveBeenCalled();
    expect(h.prisma.customPantryStaple.update).not.toHaveBeenCalled();
    expect(h.prisma.customPantryStaple.delete).not.toHaveBeenCalled();
  });

  it("pantry GET stays readable for guests (shared rows)", async () => {
    const res = await pantryRoute.GET();
    expect(res.status).toBe(200);
  });
});

describe("staples/[id]", () => {
  it("member gets 404 for another household's staple", async () => {
    h.state.user = member("u1", "h1");
    expect((await stapleItemRoute.DELETE(req("DELETE"), ctx("st-h2"))).status).toBe(404);
  });
});

describe("coupons/[id]", () => {
  it("GET: shared + own visible, other household 404", async () => {
    expect((await couponItemRoute.GET(req("GET"), ctx("c-shared"))).status).toBe(200);
    expect((await couponItemRoute.GET(req("GET"), ctx("c-h1"))).status).toBe(404);
    h.state.user = member("u1", "h1");
    expect((await couponItemRoute.GET(req("GET"), ctx("c-shared"))).status).toBe(200);
    expect((await couponItemRoute.GET(req("GET"), ctx("c-h1"))).status).toBe(200);
    expect((await couponItemRoute.GET(req("GET"), ctx("c-h2"))).status).toBe(404);
  });

  it("PATCH/DELETE: guests 401", async () => {
    expect((await couponItemRoute.PATCH(req("PATCH", { clipped: true }), ctx("c-shared"))).status).toBe(401);
    expect((await couponItemRoute.DELETE(req("DELETE"), ctx("c-shared"))).status).toBe(401);
    expect(h.prisma.coupon.update).not.toHaveBeenCalled();
    expect(h.prisma.coupon.delete).not.toHaveBeenCalled();
  });

  it("PATCH/DELETE: member 404 on shared + other household, 200 on own", async () => {
    h.state.user = member("u1", "h1");
    for (const id of ["c-shared", "c-h2"]) {
      expect((await couponItemRoute.PATCH(req("PATCH", { clipped: true }), ctx(id))).status).toBe(404);
      expect((await couponItemRoute.DELETE(req("DELETE"), ctx(id))).status).toBe(404);
    }
    expect(h.prisma.coupon.delete).not.toHaveBeenCalled();
    expect((await couponItemRoute.PATCH(req("PATCH", { clipped: true }), ctx("c-h1"))).status).toBe(200);
    expect((await couponItemRoute.DELETE(req("DELETE"), ctx("c-h1"))).status).toBe(200);
  });
});

describe("shopping-list/[id]", () => {
  it("guest cannot touch household rows", async () => {
    expect((await shoppingItemRoute.DELETE(req("DELETE"), ctx("s-h1"))).status).toBe(404);
    expect((await shoppingItemRoute.PATCH(req("PATCH", { checked: true }), ctx("s-h1"))).status).toBe(404);
  });
  it("member cannot touch other household or guest rows; can touch own", async () => {
    h.state.user = member("u1", "h1");
    expect((await shoppingItemRoute.DELETE(req("DELETE"), ctx("s-h2"))).status).toBe(404);
    expect((await shoppingItemRoute.DELETE(req("DELETE"), ctx("s-guest"))).status).toBe(404);
    expect((await shoppingItemRoute.PATCH(req("PATCH", { checked: true }), ctx("s-h1"))).status).toBe(200);
  });
  it("no-household user only touches their personal rows", async () => {
    h.state.user = userNoHousehold;
    expect((await shoppingItemRoute.DELETE(req("DELETE"), ctx("s-guest"))).status).toBe(404);
    expect((await shoppingItemRoute.DELETE(req("DELETE"), ctx("s-u-none"))).status).toBe(200);
  });
});

describe("recipes/[id] DELETE", () => {
  it("guests cannot delete the shared catalog", async () => {
    expect((await recipeItemRoute.DELETE(req("DELETE"), ctx("r-catalog"))).status).toBe(401);
    expect(h.prisma.recipe.delete).not.toHaveBeenCalled();
  });
  it("signed-in users cannot delete shared catalog rows they don't own", async () => {
    h.state.user = userNoHousehold;
    expect((await recipeItemRoute.DELETE(req("DELETE"), ctx("r-catalog"))).status).toBe(403);
    h.state.user = member("u2", "h2");
    expect((await recipeItemRoute.DELETE(req("DELETE"), ctx("r-catalog"))).status).toBe(403);
    expect((await recipeItemRoute.DELETE(req("DELETE"), ctx("r-h1"))).status).toBe(404);
    expect(h.prisma.recipe.delete).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("decideWriteScope: guest 401 SIGN_IN_REQUIRED, no household 401 HOUSEHOLD_REQUIRED", async () => {
    const g = decideWriteScope(null);
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.response.status).toBe(401);
      expect((await g.response.json()).code).toBe("SIGN_IN_REQUIRED");
    }
    const n = decideWriteScope(userNoHousehold as never);
    expect(n.ok).toBe(false);
    if (!n.ok) expect((await n.response.json()).code).toBe("HOUSEHOLD_REQUIRED");
    const m = decideWriteScope(member("u1", "h1") as never);
    expect(m.ok && m.scope.householdId).toBe("h1");
  });

  it("getActiveHouseholdId prefers the most recent membership", () => {
    const u = member("u1", "h-personal");
    u.memberships.push({
      ...u.memberships[0]!,
      id: "m2",
      householdId: "h-joined",
      createdAt: new Date("2026-06-01"),
    });
    expect(getActiveHouseholdId(u as never)).toBe("h-joined");
  });

  it("personalKitchenName", () => {
    expect(personalKitchenName("Dana", "d@x.com")).toBe("Dana's Kitchen");
    expect(personalKitchenName(null, "sec-test+1@x.com")).toBe("sec-test's Kitchen");
    expect(personalKitchenName("  ", "@x.com")).toBe("My Kitchen");
  });

  it("shoppingRowMatchesScope", () => {
    expect(shoppingRowMatchesScope({ householdId: "h1", userId: "u9" }, { householdId: "h1", userId: "u1" })).toBe(true);
    expect(shoppingRowMatchesScope({ householdId: null, userId: null }, { householdId: "h1", userId: "u1" })).toBe(false);
  });
});
