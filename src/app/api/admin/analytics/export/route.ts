import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { writeAudit } from "@/lib/admin-users";
import { currentReport } from "@/lib/demographics/analytics";
import { summaryCsv, summaryPdf } from "@/lib/demographics/summary";

export const dynamic = "force-dynamic";

/** Executive summary download (?format=csv|pdf). Aggregates only, k-anonymous. */
export async function GET(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";
    const report = await currentReport();
    const stamp = report.generatedAt.slice(0, 10);
    await writeAudit(prisma, { actorId: admin.id, targetUserId: null, action: "analytics.export", details: { format, cohort: report.cohortSize === null ? "<k" : report.cohortSize, k: report.k } });
    if (format === "pdf") {
      const bytes = await summaryPdf(report);
      return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="fridgeforge-executive-summary-${stamp}.pdf"`, "Cache-Control": "no-store" } });
    }
    return new NextResponse(summaryCsv(report), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fridgeforge-executive-summary-${stamp}.csv"`, "Cache-Control": "no-store" } });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/analytics/export", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
