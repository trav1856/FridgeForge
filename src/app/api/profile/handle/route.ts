import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProfileOwner } from "@/lib/profile-auth";
import { validateHandle } from "@/lib/profile-fields";

export const dynamic = "force-dynamic";

/** Signed-in only: is a handle valid and free (or already mine)? */
export async function GET(req: NextRequest) {
  const auth = await requireProfileOwner();
  if (!auth.ok) return auth.res;
  const r = validateHandle(req.nextUrl.searchParams.get("h") ?? "");
  if (!r.ok) return NextResponse.json({ available: false, error: r.error });
  if (r.value === auth.user.profileSlug) return NextResponse.json({ available: true, handle: r.value, mine: true });
  const taken = await prisma.user.findUnique({ where: { profileSlug: r.value }, select: { id: true } });
  return NextResponse.json(
    taken ? { available: false, error: "That handle is taken." } : { available: true, handle: r.value }
  );
}
