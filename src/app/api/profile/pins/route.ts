import { NextRequest, NextResponse } from "next/server";
import { savePins, validatePinsShape, getOwnerProfile } from "@/lib/profile";
import { ageConfirmRequired, requireProfileOwner } from "@/lib/profile-auth";

export const dynamic = "force-dynamic";

/** Replace my pins: { own: [recipeId ≤3], favorite: [recipeId ≤3] }. */
export async function PUT(req: NextRequest) {
  const auth = await requireProfileOwner();
  if (!auth.ok) return auth.res;
  if (!auth.user.ageConfirmedAt) return ageConfirmRequired();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid pins." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid pins." }, { status: 400 });
  }
  const extra = Object.keys(body).filter((k) => k !== "own" && k !== "favorite");
  if (extra.length) return NextResponse.json({ error: "Invalid pins." }, { status: 400 });
  const v = validatePinsShape(body as { own?: unknown; favorite?: unknown });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const err = await savePins(auth.user.id, v.own, v.favorite);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  return NextResponse.json(await getOwnerProfile(auth.user.id));
}
