import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfileOwner } from "@/lib/profile-auth";
import { assertSameOrigin } from "@/lib/same-origin";
import { adminErrorResponse } from "@/lib/admin";
import { DietError, getDietSettings, saveDietSettings } from "@/lib/diet/service";
import { dietSettingsSchema } from "@/lib/diet/schema";

export const dynamic = "force-dynamic";
const NS = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  const auth = await requireProfileOwner();
  if (!auth.ok) return auth.res;
  return NextResponse.json({ settings: await getDietSettings(auth.user.id) }, NS);
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireProfileOwner();
    if (!auth.ok) return auth.res;
    const body = dietSettingsSchema.parse(await req.json());
    const settings = await saveDietSettings(auth.user.id, { ...body, split: body.split ?? null });
    return NextResponse.json({ settings }, NS);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return NextResponse.json({ error: "Please fill in every field and accept the health notice." }, { status: 400 });
    if (err instanceof DietError) return NextResponse.json({ error: err.message }, { status: err.status });
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("diet/settings PUT", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
