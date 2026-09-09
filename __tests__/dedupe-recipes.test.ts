import { describe, expect, it } from "vitest";
import { dedupeRecipesByTitle } from "@/lib/dedupe-recipes";

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
});
