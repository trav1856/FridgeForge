import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfileOwner } from "@/lib/profile-auth";
import { assertSameOrigin } from "@/lib/same-origin";
import { adminErrorResponse } from "@/lib/admin";
import { DemographicsError, getDemographics, saveDemographics } from "@/lib/demographics/store";
import { demographicsSchema } from "@/lib/demographics/schema";

export const dynamic = "force-dynamic";

/** The signed-in user's own private demographics. Never exposed elsewhere. */
export async function GET() {
  const auth = await requireProfileOwner();
  if (!auth.ok) return auth.res;
  return NextResponse.json(await getDemographics(auth.user.id), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireProfileOwner();
    if (!auth.ok) return auth.res;
    const body = demographicsSchema.parse(await req.json());
    return NextResponse.json(await saveDemographics(auth.user.id, body), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (err instanceof DemographicsError) return NextResponse.json({ error: err.message }, { status: err.status });
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("account/demographics PUT", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
