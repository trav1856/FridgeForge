import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { ExportError, diskInfo, startExport, sweepExports, toJobDTO } from "@/lib/export/jobs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    await sweepExports();
    const jobs = await prisma.exportJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return NextResponse.json({ jobs: jobs.map(toJobDTO), disk: await diskInfo() });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/export GET", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const schema = z.object({
  kind: z.enum(["full", "user", "content"]),
  userId: z.string().min(1).max(64).optional().nullable(),
  password: z.string().max(200).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    const body = schema.parse(await req.json());
    const password = body.password?.length ? body.password : null;
    if (password && password.length < 8) {
      return NextResponse.json({ error: "Use a zip password of at least 8 characters." }, { status: 400 });
    }
    const job = await startExport({ actorId: admin.id, kind: body.kind, targetUserId: body.userId ?? null, password });
    return NextResponse.json({ job: toJobDTO(job) }, { status: 202 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (err instanceof ExportError) return NextResponse.json({ error: err.message }, { status: err.status });
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/export POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
