import { NextRequest, NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { ExportError, issueDownloadLink } from "@/lib/export/jobs";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** One-time download link (≤1 hour, never past the file's expiry). */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    await requireAdmin();
    const { id } = await ctx.params;
    const { token, linkExpiresAt } = await issueDownloadLink(id);
    return NextResponse.json({
      url: `/api/admin/export/download?token=${encodeURIComponent(token)}`,
      expiresAt: linkExpiresAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ExportError) return NextResponse.json({ error: err.message }, { status: err.status });
    const res = adminErrorResponse(err);
    if (res) return res;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
