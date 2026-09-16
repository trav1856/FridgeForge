import { NextRequest, NextResponse } from "next/server";
import { resolveHouseholdId } from "@/lib/auth";
import {
  PantryImageUploadError,
  clearPantryItemImage,
  setPantryItemImageFromUpload,
} from "@/lib/pantry-image-upload";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
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
    const item = await setPantryItemImageFromUpload(
      id,
      {
        mime: file.type || null,
        size: bytes.length,
        bytes,
      },
      { householdId }
    );
    return NextResponse.json({ item, imageUrl: item.imageUrl });
  } catch (err) {
    if (err instanceof PantryImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("pantry/[id]/image POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const householdId = await resolveHouseholdId();
    const { id } = await ctx.params;
    const item = await clearPantryItemImage(id, { householdId });
    return NextResponse.json({ item, imageUrl: item.imageUrl });
  } catch (err) {
    if (err instanceof PantryImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("pantry/[id]/image DELETE", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
