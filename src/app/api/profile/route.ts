import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnerProfile } from "@/lib/profile";
import { requireProfileOwner } from "@/lib/profile-auth";
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  cleanText,
  normalizeFacebookUrl,
  normalizeXUrl,
  validateHandle,
} from "@/lib/profile-fields";
import { AGE_BLOCK_COOKIE, AGE_BLOCK_SECONDS, checkMinAge } from "@/lib/age-gate";

export const dynamic = "force-dynamic";

/** Owner's own editable profile + pin candidates. */
export async function GET() {
  const auth = await requireProfileOwner();
  if (!auth.ok) return auth.res;
  const data = await getOwnerProfile(auth.user.id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

const patchSchema = z
  .object({
    displayName: z.string().max(400).optional(),
    handle: z.string().max(100).optional(),
    bio: z.string().max(2000).nullable().optional(),
    socialX: z.string().max(300).nullable().optional(),
    socialFacebook: z.string().max(300).nullable().optional(),
    profilePublic: z.boolean().optional(),
    birthDate: z.string().max(20).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest) {
  const auth = await requireProfileOwner();
  if (!auth.ok) return auth.res;
  const user = auth.user;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid profile update." }, { status: 400 });
  }

  const data: Prisma.UserUpdateInput = {};
  const fieldErrors: Record<string, string> = {};

  if (!user.ageConfirmedAt) {
    if (req.cookies.get(AGE_BLOCK_COOKIE)) {
      return NextResponse.json(
        { error: "Sorry, you need to be 13 or older to use a FridgeForge account.", code: "UNDER_MIN_AGE" },
        { status: 403 }
      );
    }
    const age = checkMinAge(body.birthDate);
    if (!age.ok) {
      const res = NextResponse.json(
        { error: age.error, code: age.code === "UNDER_MIN_AGE" ? age.code : "AGE_CONFIRM_REQUIRED" },
        { status: 403 }
      );
      if (age.code === "UNDER_MIN_AGE") {
        res.cookies.set(AGE_BLOCK_COOKIE, "1", { httpOnly: true, sameSite: "lax", maxAge: AGE_BLOCK_SECONDS, path: "/" });
      }
      return res;
    }
    data.ageConfirmedAt = new Date();
  }

  if (body.displayName !== undefined) {
    const r = cleanText(body.displayName.replace(/\n/g, " "), DISPLAY_NAME_MAX);
    if (!r.ok) fieldErrors.displayName = r.error;
    else if (!r.value) fieldErrors.displayName = "Display name can't be empty.";
    else data.name = r.value;
  }
  if (body.handle !== undefined) {
    const r = validateHandle(body.handle);
    if (!r.ok) fieldErrors.handle = r.error;
    else if (r.value !== user.profileSlug) data.profileSlug = r.value;
  }
  if (body.bio !== undefined) {
    const r = cleanText(body.bio, BIO_MAX);
    if (!r.ok) fieldErrors.bio = r.error;
    else data.bio = r.value;
  }
  if (body.socialX !== undefined) {
    const r = normalizeXUrl(body.socialX);
    if (!r.ok) fieldErrors.socialX = r.error;
    else data.socialX = r.value;
  }
  if (body.socialFacebook !== undefined) {
    const r = normalizeFacebookUrl(body.socialFacebook);
    if (!r.ok) fieldErrors.socialFacebook = r.error;
    else data.socialFacebook = r.value;
  }
  if (body.profilePublic !== undefined) data.profilePublic = body.profilePublic;

  if (Object.keys(fieldErrors).length) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors }, { status: 400 });
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors: { handle: "That handle is taken." } },
        { status: 409 }
      );
    }
    console.error("profile PATCH", err);
    return NextResponse.json({ error: "Could not save profile." }, { status: 500 });
  }
  const fresh = await getOwnerProfile(user.id);
  return NextResponse.json(fresh);
}
