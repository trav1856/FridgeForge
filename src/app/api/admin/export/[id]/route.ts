import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { toJobDTO } from "@/lib/export/jobs";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const j = await prisma.exportJob.findUnique({ where: { id } });
    if (!j) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job: toJobDTO(j) });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
