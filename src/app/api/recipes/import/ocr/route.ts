import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { normalizeBox } from "@/lib/recipe-import-crop";
import {
  ocrImageBuffer,
  prepareCropForOcr,
  saveImportPageImage,
} from "@/lib/recipe-import-ocr";
import { structureRecipeDraft } from "@/lib/recipe-import-structure";

export const runtime = "nodejs";
/** OCR + Ollama can take a while on large page photos. */
export const maxDuration = 120;

const boxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

function parseBoxField(raw: FormDataEntryValue | null) {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  try {
    return boxSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to import recipes" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart form with image (and optional box)" },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const imageEntry = form.get("image") ?? form.get("crop") ?? form.get("file");
    if (!(imageEntry instanceof File)) {
      return NextResponse.json(
        { error: "Missing image file (field: image or crop)" },
        { status: 400 }
      );
    }
    if (imageEntry.size < 32) {
      return NextResponse.json({ error: "Image file is empty" }, { status: 400 });
    }
    if (imageEntry.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image too large (max 15MB)" },
        { status: 400 }
      );
    }

    const useFullPage =
      form.get("useFullPage") === "1" ||
      form.get("useFullPage") === "true" ||
      form.get("fullPage") === "1";
    const persistPage =
      form.get("persistPage") === "1" || form.get("persistPage") === "true";
    const skipOllama =
      form.get("skipOllama") === "1" || form.get("skipOllama") === "true";
    const alreadyCropped =
      form.get("alreadyCropped") === "1" ||
      form.get("alreadyCropped") === "true" ||
      form.get("crop") === imageEntry;

    const rawBox = parseBoxField(form.get("box"));
    const box = normalizeBox(rawBox);

    const buffer = Buffer.from(await imageEntry.arrayBuffer());
    const mimeType = imageEntry.type || "image/jpeg";

    let pageImageUrl: string | null = null;
    if (persistPage && !alreadyCropped) {
      const saved = await saveImportPageImage(buffer, mimeType);
      pageImageUrl = saved.relativeUrl;
    }

    let ocrBuffer: Buffer = buffer;
    let usedBox = box;
    if (!alreadyCropped) {
      const prepared = await prepareCropForOcr({
        buffer,
        mimeType,
        box,
        useFullPage: useFullPage || !box,
      });
      ocrBuffer = Buffer.from(prepared.cropBuffer);
      usedBox = prepared.box;
    } else if (!box && useFullPage) {
      usedBox = { x: 0, y: 0, w: 1, h: 1 };
    }

    const rawText = await ocrImageBuffer(ocrBuffer);
    if (!rawText || rawText.length < 8) {
      return NextResponse.json(
        {
          error:
            "OCR found little text in the crop. Try a clearer photo, larger box, or full page.",
          rawText: rawText || "",
          box: usedBox,
          pageImageUrl,
        },
        { status: 422 }
      );
    }

    const structured = await structureRecipeDraft(rawText, {
      tryOllama: !skipOllama,
    });
    if (!structured) {
      return NextResponse.json(
        {
          error:
            "Could not structure a recipe from OCR text. Edit the OCR text and try again, or fill the form by hand.",
          rawText,
          box: usedBox,
          pageImageUrl,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      rawText,
      draft: structured.draft,
      structureSource: structured.source,
      structureModel: structured.model ?? null,
      box: usedBox,
      pageImageUrl,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    const message =
      err instanceof Error ? err.message : "OCR import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
