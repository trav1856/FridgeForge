import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import {
  RecipeImageUploadError,
  clearRecipeImage,
  setRecipeImageFromUpload,
} from "@/lib/recipe-image-upload";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    const householdId = await resolveHouseholdId();
    const { id } = await ctx.params;
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const recipe = await setRecipeImageFromUpload(
      id,
      {
        mime: file.type || null,
        size: bytes.length,
        bytes,
      },
      { userId: user?.id ?? null, householdId }
    );
    return NextResponse.json({ recipe, imageUrl: recipe.imageUrl });
  } catch (err) {
    if (err instanceof RecipeImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("recipes/[id]/image POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    const householdId = await resolveHouseholdId();
    const { id } = await ctx.params;
    const recipe = await clearRecipeImage(id, {
      userId: user?.id ?? null,
      householdId,
    });
    return NextResponse.json({ recipe, imageUrl: recipe.imageUrl });
  } catch (err) {
    if (err instanceof RecipeImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("recipes/[id]/image DELETE", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
