import { NextRequest, NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { listSharedProductsForAdmin } from "@/lib/shared-products";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const q = req.nextUrl.searchParams.get("q") || "";
    return NextResponse.json({ products: await listSharedProductsForAdmin(q.slice(0, 80)) });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/products GET", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
