import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import {
  BUDGET_GROCERY_TIPS,
  KIDS_MEAL_CAVEATS,
  KIDS_MEAL_DEALS,
  NON_RESTAURANT_KID_FOOD,
  STRUGGLE_SECTIONS,
} from "@/lib/struggle-content";

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
    expect(src).toMatch(/BUDGET_GROCERY_TIPS/);
    expect(src).toMatch(/KIDS_MEAL_DEALS/);
    // gated content lives after the early return
    const offIdx = src.indexOf("if (!struggleMode)");
    const tipsIdx = src.indexOf("BUDGET_GROCERY_TIPS.map");
    const dealsIdx = src.indexOf("KIDS_MEAL_DEALS.map");
    expect(offIdx).toBeGreaterThan(-1);
    expect(tipsIdx).toBeGreaterThan(offIdx);
    expect(dealsIdx).toBeGreaterThan(offIdx);
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
