import { describe, expect, it } from "vitest";
import { recipeIconsFrom } from "@/lib/recipe-icons";

describe("recipeIconsFrom", () => {
  it("returns noodle/garlic/spicy cues from title and ingredients", () => {
    const icons = recipeIconsFrom({
      title: "Spicy Garlic Noodle Stir",
      tags: ["chinese"],
      ingredients: [{ name: "Spaghetti" }, { name: "Garlic" }, { name: "Chili flakes" }],
    });
    const ids = icons.map((i) => i.id);
    expect(ids).toContain("noodles");
    expect(ids).toContain("garlic");
    expect(ids).toContain("spicy");
    expect(icons.length).toBeLessThanOrEqual(6);
  });

  it("prefers chicken over generic meat", () => {
    const icons = recipeIconsFrom({
      title: "Roast Chicken",
      ingredients: [{ name: "Whole chicken" }, { name: "Beef stock" }],
    });
    const ids = icons.map((i) => i.id);
    expect(ids).toContain("chicken");
    expect(ids).not.toContain("meat");
  });
});

describe("RecipeIcons markup", () => {
  it("exposes title and mobile tap label for icon meaning", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/components/RecipeIcons.tsx", "utf8");
    expect(src).toMatch(/title=\{icon\.label\}/);
    expect(src).toMatch(/aria-label=\{icon\.label\}/);
    expect(src).toMatch(/recipe-icon-label/);
    expect(src).toMatch(/use client/);
    expect(src).toMatch(/setActiveId/);
  });
});
