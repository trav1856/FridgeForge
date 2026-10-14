import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { deleteProfile, serializeProfile, setFeatured, setProfileRecipes, updateProfile } from "@/lib/content/profiles";
import { profileInputSchema } from "@/lib/content/schemas";
import { contentErrorResponse } from "@/lib/content/route-helpers";

type Ctx = { params: Promise<{ id: string }> };
const schema = profileInputSchema.extend({
  featured: z.boolean().optional(),
  recipeIds: z.array(z.string().max(40)).max(200).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const { featured, recipeIds, ...rest } = schema.parse(await req.json().catch(() => ({})));
    let p = Object.keys(rest).length ? await updateProfile(admin, id, rest) : null;
    if (featured !== undefined) p = await setFeatured(admin, id, featured);
    if (recipeIds) await setProfileRecipes(admin, id, recipeIds);
    return NextResponse.json({ chef: p ? serializeProfile(p) : null });
  } catch (err) {
    return contentErrorResponse(err, "admin/chefs/[id] PATCH");
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const { id } = await ctx.params;
    await deleteProfile(admin, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return contentErrorResponse(err, "admin/chefs/[id] DELETE");
  }
}
