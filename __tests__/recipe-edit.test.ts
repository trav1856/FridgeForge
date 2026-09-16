import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { canEditRecipe } from "@/lib/recipe-user-images";

function source(rel: string): string {
  return readFileSync(resolve(__dirname, "..", rel), "utf8");
}

describe("PATCH /api/recipes/[id] authorization", () => {
  const route = source("src/app/api/recipes/[id]/route.ts");

  it("exports PATCH and gates on canEditRecipe / owner", () => {
    expect(route).toMatch(/export async function PATCH/);
    expect(route).toMatch(/canEditRecipe/);
    expect(route).toMatch(/Forbidden/);
    expect(route).toMatch(/status:\s*403/);
    // Must require signed-in user
    expect(route).toMatch(/AuthError|getCurrentUser/);
    // Ingredients replaced on update
    expect(route).toMatch(/recipeIngredient\.deleteMany/);
  });

  it("owner passes canEditRecipe; other user fails (mirrors route gate)", () => {
    const recipe = { ownerUserId: "owner-1", householdId: "hh-1" };
    expect(
      canEditRecipe(recipe, { userId: "owner-1", householdId: "hh-1" })
    ).toBe(true);
    expect(
      canEditRecipe(recipe, { userId: "intruder", householdId: "hh-1" })
    ).toBe(false);
    expect(
      canEditRecipe(recipe, { userId: "intruder", householdId: "other-hh" })
    ).toBe(false);
  });

  it("edit page uses RecipeForm edit mode and redirects non-owners", () => {
    const page = source("src/app/recipes/[id]/edit/page.tsx");
    expect(page).toMatch(/mode=\"edit\"/);
    expect(page).toMatch(/recipeId=/);
    expect(page).toMatch(/canEditRecipe/);
    expect(page).toMatch(/redirect\(`\/recipes\/\$\{id\}`\)/);
  });

  it("detail page shows Edit only when canEditRecipe", () => {
    const page = source("src/app/recipes/[id]/page.tsx");
    expect(page).toMatch(/canEditRecipe/);
    expect(page).toMatch(/RecipeOwnerControls/);
    const ctrl = source("src/components/RecipeOwnerControls.tsx");
    expect(ctrl).toMatch(/data-testid=\"edit-recipe\"/);
    expect(ctrl).toMatch(/\/recipes\/\$\{recipeId\}\/edit/);
  });

  it("RecipeForm PATCHes when mode is edit", () => {
    const form = source("src/components/RecipeForm.tsx");
    expect(form).toMatch(/mode\?:\s*\"create\"\s*\|\s*\"edit\"/);
    expect(form).toMatch(/isEdit \? \"PATCH\" : \"POST\"/);
    expect(form).toMatch(/\/api\/recipes\/\$\{recipeId\}/);
  });
});


describe("RecipeOwnerControls visibility", () => {
  it("exposes Edit and Make public on detail for owners", () => {
    const page = source("src/app/recipes/[id]/page.tsx");
    expect(page).toMatch(/RecipeOwnerControls/);
    const ctrl = source("src/components/RecipeOwnerControls.tsx");
    expect(ctrl).toMatch(/data-testid=\"edit-recipe\"/);
    expect(ctrl).toMatch(/data-testid=\"make-public\"/);
    expect(ctrl).toMatch(/Make public/);
    expect(ctrl).toMatch(/visibility:\s*next/);
    expect(ctrl).toMatch(/\"global\"/);
  });

  it("PATCH accepts visibility-only body", () => {
    const route = source("src/app/api/recipes/[id]/route.ts");
    expect(route).toMatch(/Visibility-only update/);
    expect(route).toMatch(/bodyKeys\[0\] === \"visibility\"/);
  });
});
