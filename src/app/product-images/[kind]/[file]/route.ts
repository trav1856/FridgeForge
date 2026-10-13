import { NextRequest, NextResponse } from "next/server";
import { productImagesDir, type ProductImageKind } from "@/lib/product-images";
import { serveImageFile } from "@/lib/serve-image-file";

type Ctx = { params: Promise<{ kind: string; file: string }> };

/** Shared-product and household-override photos (written at runtime). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { kind, file } = await ctx.params;
  if (kind !== "shared" && kind !== "household") {
    return new NextResponse("Not found", { status: 404 });
  }
  return serveImageFile(productImagesDir(kind as ProductImageKind), file);
}
