import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rowMatchesScope } from "@/lib/household";
import { notFoundResponse, requireWriteScope } from "@/lib/write-scope";
import { contributeFromPantryItem } from "@/lib/shared-products";

const schema = z.object({ itemId: z.string().min(1).max(64) });

/**
 * After saving a pantry item with a barcode, record its product info:
 * first save creates the shared record; later differing saves become this
 * household's override. Signed-in households only (guests get 401).
 */
export async function POST(req: NextRequest) {
  const guard = await requireWriteScope("pantry");
  if (!guard.ok) return guard.response;
  try {
    const { itemId } = schema.parse(await req.json());
    const item = await prisma.pantryItem.findUnique({ where: { id: itemId } });
    if (!item || !rowMatchesScope(item.householdId, guard.scope.householdId)) {
      return notFoundResponse();
    }
    const out = await contributeFromPantryItem(item, {
      userId: guard.scope.user.id,
      householdId: guard.scope.householdId,
    });
    return NextResponse.json(out, { status: out.result === "rate_limited" ? 429 : 200 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    console.error("products/contribute", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
