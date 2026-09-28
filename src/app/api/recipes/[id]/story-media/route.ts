import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import {
  StoryMediaError,
  addStoryImage,
  addStoryYoutube,
  removeStoryMedia,
} from "@/lib/recipe-story-media";

type Ctx = { params: Promise<{ id: string }> };

function errorResponse(err: unknown, label: string) {
  if (err instanceof StoryMediaError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`recipes/[id]/story-media ${label}`, err);
  return NextResponse.json({ error: "Failed" }, { status: 500 });
}

/**
 * Add story media. multipart/form-data with `file` = photo upload;
 * JSON body `{ youtubeUrl }` = YouTube link. Owner only.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    const householdId = await resolveHouseholdId();
    const actor = { userId: user?.id ?? null, householdId };
    const { id } = await ctx.params;
    const ctype = (req.headers.get("content-type") || "").toLowerCase();

    if (ctype.includes("multipart/form-data")) {
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
      const result = await addStoryImage(
        id,
        { mime: file.type || null, size: bytes.length, bytes },
        actor
      );
      return NextResponse.json(result);
    }

    const body = (await req.json().catch(() => null)) as {
      youtubeUrl?: unknown;
    } | null;
    const url = typeof body?.youtubeUrl === "string" ? body.youtubeUrl : "";
    if (!url.trim() || url.length > 500) {
      return NextResponse.json(
        { error: "Missing YouTube link" },
        { status: 400 }
      );
    }
    const result = await addStoryYoutube(id, url, actor);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "POST");
  }
}

/** Remove one story media item: `?itemId=...` (deletes the stored photo file). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    const householdId = await resolveHouseholdId();
    const { id } = await ctx.params;
    const itemId = req.nextUrl.searchParams.get("itemId") || "";
    if (!itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }
    const result = await removeStoryMedia(id, itemId, {
      userId: user?.id ?? null,
      householdId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "DELETE");
  }
}
