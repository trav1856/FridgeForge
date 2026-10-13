import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/admin-users";
import { exportDir } from "@/lib/export/build";
import { consumeDownloadToken } from "@/lib/export/jobs";

export const dynamic = "force-dynamic";

/** Admin session + a one-time token. The token is spent on first use. */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const token = req.nextUrl.searchParams.get("token") || "";
    const job = await consumeDownloadToken(token);
    if (!job) {
      return NextResponse.json({ error: "This download link has expired or was already used." }, { status: 410 });
    }
    const file = path.join(exportDir(), `${job.id}.zip`);
    const st = await stat(file).catch(() => null);
    if (!st) return NextResponse.json({ error: "Export file is gone." }, { status: 410 });
    await writeAudit(prisma, {
      actorId: admin.id,
      targetUserId: job.targetUserId,
      action: "export.download",
      details: { jobId: job.id, kind: job.kind, sizeBytes: st.size, manifestSha256: job.manifestSha256 },
    });
    const body = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(st.size),
        "Content-Disposition": `attachment; filename="${job.fileName ?? `fridgeforge-${job.kind}.zip`}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/export download", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
