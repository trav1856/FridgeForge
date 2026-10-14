import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/same-origin";
import { saveContentImage } from "@/lib/content/images";
import { canAuthorPosts } from "@/lib/content/permissions";
import { ContentError } from "@/lib/content/util";
import { contentErrorResponse, requireViewer } from "@/lib/content/route-helpers";
import { REENCODE_MAX_INPUT_BYTES } from "@/lib/image-reencode";

/** Upload a chef photo / post cover / inline photo. Re-encoded to WebP (EXIF/GPS stripped). */
export async function POST(req: NextRequest) {
  try {
    const v = await requireViewer();
    assertSameOrigin(req);
    if (!canAuthorPosts(v)) throw new ContentError("Forbidden", 403);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ContentError("Missing file");
    if (file.size > REENCODE_MAX_INPUT_BYTES) throw new ContentError("Image must be 8MB or smaller.", 413);
    const url = await saveContentImage(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url });
  } catch (err) {
    return contentErrorResponse(err, "content/images POST");
  }
}
