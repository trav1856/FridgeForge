import { NextRequest, NextResponse } from "next/server";
import { lookupOpenFoodFacts } from "@/lib/open-food-facts";
import { resolveHouseholdId } from "@/lib/auth";
import { canonicalBarcode } from "@/lib/barcode";
import { quantityFromSize, resolveProductForScan } from "@/lib/shared-products";

/**
 * Read-only for everyone (guests included): household override → shared
 * product record → Open Food Facts. Never writes.
 */
export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get("barcode")?.trim() || "";
  if (!barcode) {
    return NextResponse.json({ error: "barcode required" }, { status: 400 });
  }
  try {
    if (canonicalBarcode(barcode)) {
      const householdId = await resolveHouseholdId().catch(() => null);
      const p = await resolveProductForScan(barcode, householdId);
      if (p) {
        return NextResponse.json({
          found: true,
          barcode: p.barcode,
          name: p.name,
          size: p.size,
          suggestedUnit: p.unit || undefined,
          suggestedQuantity: quantityFromSize(p.size),
          suggestedCategory: p.category || undefined,
          imageUrl: p.imageUrl,
          source: p.source,
        });
      }
    }
    const result = await lookupOpenFoodFacts(barcode);
    return NextResponse.json({ ...result, source: result.found ? "openfoodfacts" : null });
  } catch {
    return NextResponse.json(
      { error: "Lookup failed", found: false, barcode },
      { status: 502 }
    );
  }
}
