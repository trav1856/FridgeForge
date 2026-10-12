import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ageConfirmRequired, requireProfileOwner } from "@/lib/profile-auth";
import {
  PROFILE_IMAGE_MAX_BYTES,
  ProfileImageError,
  deleteManagedProfileImage,
  parseCropParams,
  processProfileImage,
  saveProfileImageFile,
  type ProfileImageKind,
} from "@/lib/profile-images";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ kind: string }> };

function kindOf(raw: string): ProfileImageKind | null {
  return raw === "avatar" || raw === "banner" ? raw : null;
}
const column = (k: ProfileImageKind) => (k === "avatar" ? "avatarUrl" : "bannerUrl");

/** Upload (multipart: file, zoom, focusX, focusY) → cropped WebP; replaces and deletes the old file. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireProfileOwner();
  if (!auth.ok) return auth.res;
  if (!auth.user.ageConfirmedAt) return ageConfirmRequired();
  const kind = kindOf((await ctx.params).kind);
  if (!kind) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const len = Number(req.headers.get("content-length") || 0);
  if (len > PROFILE_IMAGE_MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Image must be 8MB or smaller." }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const webp = await processProfileImage(bytes, kind, parseCropParams((k) => form.get(k)));
    const url = await saveProfileImageFile(auth.user.id, kind, webp);
    const col = column(kind);
    const before = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { [col]: true } });
    await prisma.user.update({ where: { id: auth.user.id }, data: { [col]: url } });
    const old = (before as Record<string, string | null> | null)?.[col];
    if (old && old !== url) await deleteManagedProfileImage(old);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof ProfileImageError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("profile image POST", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireProfileOwner();
  if (!auth.ok) return auth.res;
  const kind = kindOf((await ctx.params).kind);
  if (!kind) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const col = column(kind);
  const before = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { [col]: true } });
  await prisma.user.update({ where: { id: auth.user.id }, data: { [col]: null } });
  await deleteManagedProfileImage((before as Record<string, string | null> | null)?.[col]);
  return NextResponse.json({ url: null });
}
