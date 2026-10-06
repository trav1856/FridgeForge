/**
 * Guest demo mode (Steps 2–5): guest calculation endpoints are read-only,
 * guests can't write shopping rows / recipes, coupons are samples for guests
 * and own-household-only for members, and the seed creates no null-scope rows.
 * Prisma is a strict mock: every write method is a spy that must stay unused.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const WRITE_METHODS = ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"] as const;

const h = vi.hoisted(() => {
  const data: Record<string, Record<string, unknown>[]> = {};
  const models: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const writes = ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"];
  function model(name: string) {
    if (models[name]) return models[name]!;
    const rows = () => data[name] ?? [];
    const m: Record<string, ReturnType<typeof vi.fn>> = {
      findMany: vi.fn(async () => rows()),
      findUnique: vi.fn(async ({ where }: { where: { id?: string } }) =>
        rows().find((r) => r.id === where?.id) ?? null
      ),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => rows().length),
      groupBy: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _avg: {}, _count: 0 })),
    };
    for (const w of writes) m[w] = vi.fn(async () => ({ id: "written", count: 0 }));
    models[name] = m;
    return m;
  }
  const prisma = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "$transaction") {
          return vi.fn(async (fn: unknown) =>
            typeof fn === "function" ? (fn as (p: unknown) => unknown)(prisma) : Promise.all(fn as unknown[])
          );
        }
        if (prop === "then") return undefined;
        return model(prop);
      },
    }
  );
  const state: { user: unknown } = { user: null };
  return { prisma, models, data, state };
});

vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/auth", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...orig,
    getCurrentUser: vi.fn(async () => h.state.user),
    resolveHouseholdId: vi.fn(async () => orig.getActiveHouseholdId(h.state.user as never)),
  };
});

import * as suggestionsRoute from "@/app/api/suggestions/route";
import * as dealsRoute from "@/app/api/suggestions/deals/route";
import * as weeklyMenuRoute from "@/app/api/weekly-menu/route";
import * as shoppingRoute from "@/app/api/shopping-list/route";
import * as shoppingItemRoute from "@/app/api/shopping-list/[id]/route";
import * as recipesRoute from "@/app/api/recipes/route";
import * as couponsRoute from "@/app/api/coupons/route";
import * as starterRoute from "@/app/api/pantry/starter/route";
import {
  addDemoItem,
  demoPantryFixture,
  parseDemoPantry,
  removeDemoItem,
  toCalcPantry,
  updateDemoItem,
} from "@/lib/demo-pantry";
import { SAMPLE_COUPONS, SAMPLE_WATERMARK } from "@/lib/sample-coupons";
import { addLocalShopping, clearLocalChecked, parseLocalShopping, setLocalChecked } from "@/lib/local-shopping-list";
import { STARTER_STAPLES } from "@/lib/starter-staples";

const stamps = { createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") };

function recipeRow(id: string, ingredients: [string, number, string][]) {
  return {
    id,
    title: `Recipe ${id}`,
    description: null,
    steps: "[]",
    costTier: "cheap",
    tags: "[]",
    cuisine: null,
    course: null,
    foodCategories: "[]",
    origins: "[]",
    meatType: null,
    originStory: null,
    dishKey: null,
    servings: 2,
    cookTimeMinutes: 15,
    imageUrl: null,
    isStruggleMeal: false,
    allergenTags: "[]",
    techniqueTips: "[]",
    flavorBoosters: "[]",
    householdId: null,
    ownerUserId: null,
    visibility: "global",
    ...stamps,
    ingredients: ingredients.map(([name, quantity, unit], i) => ({
      id: `${id}-i${i}`,
      recipeId: id,
      name,
      quantity,
      unit,
      optional: false,
    })),
  };
}

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

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
const get = (url: string) => new NextRequest(`http://localhost${url}`);

function expectNoWrites() {
  for (const [name, m] of Object.entries(h.models)) {
    for (const w of WRITE_METHODS) {
      expect(m[w], `${name}.${w}`).not.toHaveBeenCalled();
    }
  }
}

const demoPantry = toCalcPantry(demoPantryFixture());

beforeEach(() => {
  vi.clearAllMocks();
  h.state.user = null;
  for (const k of Object.keys(h.data)) delete h.data[k];
  h.data.recipe = [
    recipeRow("r-rice", [["White rice", 1, "cups"], ["Eggs", 2, "each"], ["Soy sauce", 1, "tbsp"]]),
    recipeRow("r-pasta", [["Spaghetti", 8, "oz"], ["Butter", 2, "tbsp"]]),
  ];
  // Legacy shared rows must never leak to guests.
  h.data.pantryItem = [{ id: "p-shared", name: "Spaghetti", quantity: 1, unit: "lb", tags: "[]", householdId: null, ...stamps }];
  h.data.coupon = [];
});

describe("guest calculation endpoints are read-only", () => {
  it("POST /api/suggestions scores the posted demo pantry, writes nothing", async () => {
    const res = await suggestionsRoute.POST(post("/api/suggestions?maxMissing=2", { pantry: demoPantry }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.demoPantry).toBe(true);
    expect(data.pantryCount).toBe(17);
    const rice = data.suggestions.find((s: { recipe: { id: string } }) => s.recipe.id === "r-rice");
    expect(rice.canMakeNow).toBe(true);
    expect(rice.matchRatio).toBe(1);
    // Pantry is never read from the DB for guests.
    expect(h.models.pantryItem?.findMany ?? vi.fn()).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("GET /api/suggestions for guests uses an empty pantry (no shared pool)", async () => {
    const data = await (await suggestionsRoute.GET(get("/api/suggestions"))).json();
    expect(data.pantryCount).toBe(0);
    expect(h.models.pantryItem?.findMany ?? vi.fn()).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("POST /api/suggestions/deals: canMakeNow from demo pantry; sample deals for missing items", async () => {
    const ok = await (await dealsRoute.POST(post("/api/suggestions/deals", { recipeId: "r-rice", pantry: demoPantry }))).json();
    expect(ok.canMakeNow).toBe(true);
    expect(ok.missingIngredients).toEqual([]);
    expect(ok.demoPantry).toBe(true);
    const miss = await (await dealsRoute.POST(post("/api/suggestions/deals", { recipeId: "r-pasta", pantry: demoPantry }))).json();
    expect(miss.canMakeNow).toBe(false);
    expect(miss.deals.length).toBeGreaterThan(0);
    for (const d of miss.deals) {
      expect(d.sample).toBe(true);
      expect(d.id.startsWith("sample-")).toBe(true);
    }
    expect(h.models.coupon?.findMany ?? vi.fn()).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("garbage pantry payload is ignored (empty pantry), still read-only", async () => {
    const res = await dealsRoute.POST(post("/api/suggestions/deals", { recipeId: "r-rice", pantry: "DROP TABLE" }));
    const data = await res.json();
    expect(data.pantryCount).toBe(0);
    expectNoWrites();
  });

  it("POST /api/weekly-menu build/remix for guests: plan returned, nothing persisted", async () => {
    for (const action of ["build", "remix"]) {
      const res = await weeklyMenuRoute.POST(post("/api/weekly-menu", { action, struggleMode: false, pantry: demoPantry }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.persisted).toBe(false);
      expect(data.pantryCount).toBe(17);
      expect(data.plan).toBeTruthy();
    }
    expectNoWrites();
  });

  it("members ignore a posted pantry and use their own household", async () => {
    h.state.user = member("u1", "h1");
    h.data.pantryItem = [];
    const data = await (await suggestionsRoute.POST(post("/api/suggestions", { pantry: demoPantry }))).json();
    expect(data.pantryCount).toBe(0);
    expect(data.demoPantry).toBe(false);
    expect(h.models.pantryItem!.findMany).toHaveBeenCalledWith({ where: { householdId: "h1" } });
  });
});

describe("guest shopping list is browser-local", () => {
  it("GET returns [] and writes are 401 for guests", async () => {
    const list = await (await shoppingRoute.GET()).json();
    expect(list.items).toEqual([]);
    expect((await shoppingRoute.POST(post("/api/shopping-list", { items: [{ name: "Milk" }] }))).status).toBe(401);
    expect((await shoppingRoute.DELETE()).status).toBe(401);
    const ctx = { params: Promise.resolve({ id: "anything" }) };
    expect((await shoppingItemRoute.DELETE(get("/x"), ctx)).status).toBe(404);
    expectNoWrites();
  });

  it("local reducers add (deduped), check, clear", () => {
    let r = addLocalShopping([], [{ name: "Milk" }, { name: "milk" }, { name: "Eggs", quantity: 12, unit: "each" }]);
    expect(r.added).toBe(2);
    const milk = r.items.find((i) => i.name === "Milk")!;
    let items = setLocalChecked(r.items, milk.id, true);
    items = clearLocalChecked(items);
    expect(items.map((i) => i.name)).toEqual(["Eggs"]);
    expect(parseLocalShopping(JSON.stringify(items))).toHaveLength(1);
    expect(parseLocalShopping("not json")).toEqual([]);
    r = addLocalShopping(items, [{ name: "Eggs" }]);
    expect(r.added).toBe(0);
  });
});

describe("recipes POST", () => {
  it("guests get 401 and nothing is created", async () => {
    const res = await recipesRoute.POST(
      post("/api/recipes", { title: "Guest soup", ingredients: [{ name: "Water", quantity: 1, unit: "cup" }], steps: ["Boil"] })
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/sign in/i);
    expectNoWrites();
  });
});

describe("coupons list", () => {
  it("guests get static samples: watermark-ready, no brand, no price, no code", async () => {
    const data = await (await couponsRoute.GET(get("/api/coupons?filter=active"))).json();
    expect(data).toHaveLength(SAMPLE_COUPONS.length);
    for (const c of data) {
      expect(c.sample).toBe(true);
      expect(c.brand).toBe("Sample coupon");
      expect(c.discountText).toMatch(/^Save on /);
      expect(c.discountText).not.toMatch(/\$|\d+%|¢/);
      expect(c.codeValue).toBe("SAMPLE");
    }
    expect(SAMPLE_WATERMARK).toBe("SAMPLE — NOT VALID");
    expect(h.models.coupon?.findMany ?? vi.fn()).not.toHaveBeenCalled();
    const clipped = await (await couponsRoute.GET(get("/api/coupons?filter=clipped"))).json();
    expect(clipped).toEqual([]);
  });

  it("members get only their own household's coupons (no shared rows)", async () => {
    h.state.user = member("u1", "h1");
    await couponsRoute.GET(get("/api/coupons?filter=all"));
    expect(h.models.coupon!.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: "h1" } })
    );
  });
});

describe("starter staples", () => {
  it("guests 401; members add only missing names to their own household", async () => {
    expect((await starterRoute.POST()).status).toBe(401);
    expectNoWrites();
    h.state.user = member("u1", "h1");
    h.data.pantryItem = [{ id: "p1", name: "Eggs", householdId: "h1" }];
    const res = await starterRoute.POST();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.added).toBe(STARTER_STAPLES.length - 1);
    const call = h.models.pantryItem!.createMany!.mock.calls[0]![0] as { data: { householdId: string; name: string }[] };
    expect(call.data.every((d) => d.householdId === "h1")).toBe(true);
    expect(call.data.some((d) => d.name === "Eggs")).toBe(false);
  });
});

describe("demo pantry reducers", () => {
  it("fixture has 17 items; corrupt storage falls back to it", () => {
    expect(demoPantryFixture()).toHaveLength(17);
    expect(parseDemoPantry(null)).toHaveLength(17);
    expect(parseDemoPantry("{bad")).toHaveLength(17);
    expect(parseDemoPantry("[]")).toHaveLength(0);
  });

  it("add merges by name+unit, update and remove work", () => {
    const base = demoPantryFixture();
    const merged = addDemoItem(base, { name: "eggs", quantity: 6, unit: "each" });
    expect(merged.merged).toBe(true);
    expect(merged.items.find((i) => i.name === "Eggs")!.quantity).toBe(18);
    const added = addDemoItem(base, { name: "Milk", quantity: 1, unit: "gal" });
    expect(added.items).toHaveLength(18);
    const updated = updateDemoItem(base, "demo-1", { quantity: 0 });
    expect(updated.find((i) => i.id === "demo-1")!.quantity).toBe(0);
    expect(removeDemoItem(base, "demo-1")).toHaveLength(16);
  });
});

describe("seed no longer creates null-scope rows", () => {
  const seed = readFileSync(join(__dirname, "..", "prisma", "seed.ts"), "utf8");

  it("no pantry item, coupon or custom staple creation in the seed", () => {
    expect(seed).not.toMatch(/pantryItem\.(create|createMany|upsert)\b/);
    expect(seed).not.toMatch(/coupon\.(create|createMany|upsert)\b/);
    expect(seed).not.toMatch(/customPantryStaple\.(create|createMany|upsert)\b/);
    expect(seed).not.toMatch(/shoppingListItem\.(create|createMany|upsert)\b/);
  });

  it("never creates the pro demo with a default password or modifies an existing one", () => {
    expect(seed).not.toMatch(/prodemo/);
    expect(seed).not.toMatch(/user\.(update|upsert)\b/);
    expect(seed).toMatch(/FF_PRO_DEMO_PASSWORD/);
  });

  it("migration retires the shared pool and adds cascades", () => {
    const sql = readFileSync(
      join(__dirname, "..", "prisma", "migrations", "20261006230000_retire_shared_pool", "migration.sql"),
      "utf8"
    );
    expect(sql).toMatch(/DELETE FROM "PantryItem" WHERE "householdId" IS NULL/);
    expect(sql).toMatch(/DELETE FROM "CustomPantryStaple" WHERE "householdId" IS NULL/);
    expect(sql).toMatch(/DELETE FROM "Coupon" WHERE "householdId" IS NULL/);
    expect(sql).toMatch(/DELETE FROM "ShoppingListItem" WHERE "householdId" IS NULL AND "userId" IS NULL/);
    expect(sql.match(/ON DELETE CASCADE/g)).toHaveLength(3);
  });
});
