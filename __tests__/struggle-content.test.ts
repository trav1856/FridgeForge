import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import {
  BUDGET_GROCERY_TIPS,
  KIDS_MEAL_CAVEATS,
  KIDS_MEAL_DEALS,
  NON_RESTAURANT_KID_FOOD,
  STRUGGLE_SECTIONS,
  kidsMealDetailBody,
  tipDetailBody,
} from "@/lib/struggle-content";
import {
  buildStruggleSeedRows,
  normalizeStruggleKind,
  parseStruggleLinks,
  slugifyStruggleTitle,
} from "@/lib/struggle-resources";
import { isAdmin } from "@/lib/admin";

function source(rel: string): string {
  return readFileSync(resolve(__dirname, "..", rel), "utf8");
}

describe("struggle content data", () => {
  it("includes practical budget grocery tips Aron approved", () => {
    const titles = BUDGET_GROCERY_TIPS.map((t) => t.title.toLowerCase());
    expect(BUDGET_GROCERY_TIPS.length).toBeGreaterThanOrEqual(8);
    expect(titles.some((t) => t.includes("pantry"))).toBe(true);
    expect(titles.some((t) => t.includes("unit price"))).toBe(true);
    expect(titles.some((t) => t.includes("store brand"))).toBe(true);
    expect(titles.some((t) => t.includes("beans") || t.includes("thigh"))).toBe(
      true
    );
    expect(titles.some((t) => t.includes("frozen"))).toBe(true);
    expect(titles.some((t) => t.includes("batch"))).toBe(true);
    expect(titles.some((t) => t.includes("loyalty"))).toBe(true);
  });

  it("lists national kids-meal chains with caveats", () => {
    const places = KIDS_MEAL_DEALS.map((d) => d.place.toLowerCase());
    for (const name of [
      "denny",
      "ihop",
      "smashburger",
      "outback",
      "dickey",
      "bob evans",
      "tgi friday",
      "ruby tuesday",
      "wings and rings",
      "mellow mushroom",
      "mod pizza",
      "freebirds",
      "tony roma",
      "chili",
      "fogo",
      "wendy",
    ]) {
      expect(places.some((p) => p.includes(name))).toBe(true);
    }
    expect(KIDS_MEAL_CAVEATS.some((c) => /verify|location/i.test(c))).toBe(
      true
    );
    expect(KIDS_MEAL_CAVEATS.some((c) => /not affiliated/i.test(c))).toBe(true);
    expect(NON_RESTAURANT_KID_FOOD.body).toMatch(/USDA Summer Meals/i);
    expect(NON_RESTAURANT_KID_FOOD.body).toMatch(/pantr/i);
  });

  it("exposes section anchors for the hub", () => {
    expect(STRUGGLE_SECTIONS.map((s) => s.id)).toEqual([
      "budget-tips",
      "kids-meals",
    ]);
  });

  it("builds seed rows covering tips + kids + usda entry", () => {
    const rows = buildStruggleSeedRows();
    const tips = rows.filter((r) => r.kind === "tip");
    const kids = rows.filter((r) => r.kind === "kids_meal");
    expect(tips.length).toBe(BUDGET_GROCERY_TIPS.length);
    expect(kids.length).toBe(KIDS_MEAL_DEALS.length + 1);
    expect(rows.some((r) => r.slug === "unit-price")).toBe(true);
    expect(rows.some((r) => r.slug === "dennys")).toBe(true);
    expect(rows.some((r) => r.slug === "usda-pantries")).toBe(true);
    const unit = rows.find((r) => r.slug === "unit-price")!;
    expect(unit.body.length).toBeGreaterThan(unit.summary.length);
    expect(tipDetailBody("unit-price", "Compare unit price", "short")).toMatch(
      /unit price/i
    );
    expect(kidsMealDetailBody("dennys", "Denny’s", "note", undefined)).toMatch(
      /not affiliated/i
    );
  });
});

describe("struggle resource helpers", () => {
  it("slugifies titles", () => {
    expect(slugifyStruggleTitle("Compare unit price")).toBe(
      "compare-unit-price"
    );
    expect(slugifyStruggleTitle("!!!")).toBe("resource");
  });

  it("normalizes kind", () => {
    expect(normalizeStruggleKind("tip")).toBe("tip");
    expect(normalizeStruggleKind("kids_meal")).toBe("kids_meal");
    expect(normalizeStruggleKind("blog")).toBeNull();
  });

  it("parses safe http(s) links only", () => {
    const links = parseStruggleLinks([
      { label: "USDA", url: "https://www.fns.usda.gov/sfsp" },
      { label: "bad", url: "javascript:alert(1)" },
      { label: "", url: "https://x.com" },
    ]);
    expect(links).toEqual([
      { label: "USDA", url: "https://www.fns.usda.gov/sfsp" },
    ]);
  });
});

describe("Struggle Mode visibility gate", () => {
  it("home strip returns null when struggle is off", () => {
    const src = source("src/components/StruggleHomeStrip.tsx");
    expect(src).toMatch(/useStruggleMode/);
    expect(src).toMatch(/if\s*\(\s*!struggleMode\s*\)\s*return\s+null/);
    expect(src).toMatch(/struggle-home-strip/);
    expect(src).toMatch(/\/struggle/);
  });

  it("StruggleResources hides tip/deal lists unless struggle is on", () => {
    const src = source("src/components/StruggleResources.tsx");
    expect(src).toMatch(/useStruggleMode/);
    expect(src).toMatch(/if\s*\(\s*!struggleMode\s*\)/);
    expect(src).toMatch(/tips\.map/);
    expect(src).toMatch(/kidsMeals\.map/);
    const offIdx = src.indexOf("if (!struggleMode)");
    const tipsIdx = src.indexOf("tips.map");
    const dealsIdx = src.indexOf("kidsMeals.map");
    expect(offIdx).toBeGreaterThan(-1);
    expect(tipsIdx).toBeGreaterThan(offIdx);
    expect(dealsIdx).toBeGreaterThan(offIdx);
  });

  it("StruggleDetail is struggleMode-gated", () => {
    const src = source("src/components/StruggleDetail.tsx");
    expect(src).toMatch(/useStruggleMode/);
    expect(src).toMatch(/if\s*\(\s*!struggleMode\s*\)/);
    expect(src).toMatch(/StruggleArticleBody/);
  });

  it("nav Struggle link is struggleMode-gated (not always listed)", () => {
    const src = source("src/components/Nav.tsx");
    expect(src).toMatch(/struggleLink/);
    expect(src).toMatch(
      /\[\.\.\.baseLinks,\s*\.\.\.\(struggleMode\s*\?\s*\[struggleLink\]\s*:\s*\[\]\)\]/
    );
    const baseBlock = src.slice(
      src.indexOf("const baseLinks"),
      src.indexOf("const struggleLink")
    );
    expect(baseBlock).not.toMatch(/struggle/i);
    expect(src).toMatch(
      /const struggleLink = \{\s*href:\s*"\/struggle"/
    );
  });

  it("banner resource chips only render when struggle is on", () => {
    const src = source("src/components/StruggleBanner.tsx");
    expect(src).toMatch(/if\s*\(\s*!struggleMode\s*\)\s*return\s+null/);
    expect(src).toMatch(/\/struggle#budget-tips/);
    expect(src).toMatch(/\/struggle#kids-meals/);
  });

  it("does not put Struggle resources into How-to hub", () => {
    const howto = source("src/components/HowToHub.tsx");
    expect(howto).not.toMatch(/BUDGET_GROCERY_TIPS|KIDS_MEAL_DEALS|\/struggle/);
    const howtoPage = source("src/app/howto/page.tsx");
    expect(howtoPage).not.toMatch(/struggle-content|Kids eat free/i);
  });

  it("home page mounts StruggleHomeStrip", () => {
    const src = source("src/app/page.tsx");
    expect(src).toMatch(/StruggleHomeStrip/);
  });
});

describe("Struggle admin CRUD ownership", () => {
  it("admin write APIs call requireAdmin", () => {
    const list = source("src/app/api/admin/struggle/route.ts");
    const one = source("src/app/api/admin/struggle/[id]/route.ts");
    expect(list).toMatch(/requireAdmin/);
    expect(list).toMatch(/export async function POST/);
    expect(one).toMatch(/requireAdmin/);
    expect(one).toMatch(/export async function PATCH/);
    expect(one).toMatch(/export async function DELETE/);
  });

  it("admin page lives under /admin/struggle and uses panel", () => {
    const page = source("src/app/admin/struggle/page.tsx");
    expect(page).toMatch(/AdminStrugglePanel/);
    expect(page).toMatch(/listAdminStruggleResources/);
    const layout = source("src/app/admin/layout.tsx");
    expect(layout).toMatch(/\/admin\/struggle/);
    expect(layout).toMatch(/isAdmin/);
  });

  it("isAdmin gate still admin-only for writes conceptually", () => {
    expect(isAdmin({ role: "user" })).toBe(false);
    expect(isAdmin({ role: "admin" })).toBe(true);
  });

  it("public hub loads from DB helpers (not only static maps)", () => {
    const page = source("src/app/struggle/page.tsx");
    expect(page).toMatch(/listPublishedStruggleResources/);
    const detail = source("src/app/struggle/[slug]/page.tsx");
    expect(detail).toMatch(/getPublishedStruggleBySlug/);
  });
});
