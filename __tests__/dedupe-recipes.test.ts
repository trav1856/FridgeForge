import { describe, expect, it } from "vitest";
import { dedupeRecipesByTitle, normalizeRecipeTitle } from "@/lib/dedupe-recipes";
import { recipeScopeWhere } from "@/lib/household";

describe("normalizeRecipeTitle", () => {
  it("trims and collapses whitespace case-insensitively", () => {
    expect(normalizeRecipeTitle("  Banana   Bread ")).toBe("banana bread");
  });
});

describe("dedupeRecipesByTitle", () => {
  it("keeps one title and prefers household over shared", () => {
    const hh = "hh1";
    const out = dedupeRecipesByTitle(
      [
        { id: "a", title: "Banana Bread", householdId: null },
        { id: "b", title: "Banana Bread", householdId: hh },
        { id: "c", title: "Grilled Cheese", householdId: null },
      ],
      hh
    );
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.title === "Banana Bread")?.id).toBe("b");
  });

  it("prefers household for any active householdId", () => {
    const hh = "trav-household-xyz";
    const out = dedupeRecipesByTitle(
      [
        { id: "shared", title: "Scrambled Eggs", householdId: null },
        { id: "copy", title: "Scrambled Eggs", householdId: hh },
      ],
      hh
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("copy");
  });

  it("when guest (null household), keeps a single shared winner", () => {
    const out = dedupeRecipesByTitle(
      [
        { id: "a", title: "Rice", householdId: null },
        { id: "b", title: "Rice", householdId: null },
      ],
      null
    );
    expect(out).toHaveLength(1);
  });
});

describe("recipeScopeWhere + dedupe (mental integration)", () => {
  it("signed-in scope can return shared OR household; dedupe collapses title collisions", () => {
    const hh = "hh-demo";
    expect(recipeScopeWhere(hh)).toEqual({
      OR: [{ householdId: null }, { householdId: hh }],
    });
    const scoped = [
      { id: "s1", title: "Grilled Cheese", householdId: null },
      { id: "h1", title: "Grilled Cheese", householdId: hh },
      { id: "h2", title: "My Unique Chili", householdId: hh },
    ];
    const out = dedupeRecipesByTitle(scoped, hh);
    expect(out.map((r) => r.id).sort()).toEqual(["h1", "h2"]);
  });
});
