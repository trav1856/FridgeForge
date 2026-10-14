import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { createProfile, serializeProfile } from "@/lib/content/profiles";
import { profileInputSchema } from "@/lib/content/schemas";
import { contentErrorResponse } from "@/lib/content/route-helpers";

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.featuredProfile.findMany({
      orderBy: [{ hidden: "asc" }, { name: "asc" }],
      include: { user: { select: { id: true, name: true, profileSlug: true, isChef: true, chefCanPublish: true } }, _count: { select: { recipes: true, posts: true } } },
    });
    return NextResponse.json({ chefs: rows.map(serializeProfile) });
  } catch (err) {
    return contentErrorResponse(err, "admin/chefs GET");
  }
}

/** Create an admin-managed chef (no account). */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const p = await createProfile(admin, profileInputSchema.parse(await req.json().catch(() => ({}))));
    return NextResponse.json({ chef: serializeProfile(p) }, { status: 201 });
  } catch (err) {
    return contentErrorResponse(err, "admin/chefs POST");
  }
}
