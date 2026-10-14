import { NextRequest, NextResponse } from "next/server";
import { profileInputSchema } from "@/lib/content/schemas";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/same-origin";
import { serializeProfile, updateProfile } from "@/lib/content/profiles";
import { ContentError } from "@/lib/content/util";
import { contentErrorResponse, requireViewer } from "@/lib/content/route-helpers";


async function ownProfile(userId: string) {
  const p = await prisma.featuredProfile.findUnique({ where: { userId } });
  if (!p) throw new ContentError("No chef profile on this account", 404);
  return p;
}

/** The signed-in chef's own profile. */
export async function GET() {
  try {
    const v = await requireViewer();
    return NextResponse.json({ profile: serializeProfile(await ownProfile(v.id)) });
  } catch (err) {
    return contentErrorResponse(err, "content/profile GET");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const v = await requireViewer();
    assertSameOrigin(req);
    const p = await ownProfile(v.id);
    const updated = await updateProfile(v, p.id, profileInputSchema.parse(await req.json().catch(() => ({}))));
    return NextResponse.json({ profile: serializeProfile(updated) });
  } catch (err) {
    return contentErrorResponse(err, "content/profile PATCH");
  }
}
