import { NextRequest, NextResponse } from "next/server";
import { lookupOpenFoodFacts } from "@/lib/open-food-facts";

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get("barcode")?.trim() || "";
  if (!barcode) {
    return NextResponse.json({ error: "barcode required" }, { status: 400 });
  }
  try {
    const result = await lookupOpenFoodFacts(barcode);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Lookup failed", found: false, barcode },
      { status: 502 }
    );
  }
}
