import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { addPin, adminPins, movePin, removePin } from "@/lib/content/pins";
import { contentErrorResponse } from "@/lib/content/route-helpers";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ pins: await adminPins() });
  } catch (err) {
    return contentErrorResponse(err, "admin/pins GET");
  }
}

const add = z.object({ kind: z.enum(["profile", "post"]), refId: z.string().min(1).max(40) });
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const { kind, refId } = add.parse(await req.json().catch(() => ({})));
    return NextResponse.json({ pin: await addPin(admin, kind, refId) }, { status: 201 });
  } catch (err) {
    return contentErrorResponse(err, "admin/pins POST");
  }
}

const move = z.object({ pinId: z.string().min(1).max(40), dir: z.union([z.literal(-1), z.literal(1)]) });
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const { pinId, dir } = move.parse(await req.json().catch(() => ({})));
    await movePin(admin, pinId, dir);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return contentErrorResponse(err, "admin/pins PATCH");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    await removePin(admin, req.nextUrl.searchParams.get("pinId") || "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return contentErrorResponse(err, "admin/pins DELETE");
  }
}
