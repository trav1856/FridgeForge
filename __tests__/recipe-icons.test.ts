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
