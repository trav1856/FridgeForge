import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/admin";
import { ImageReencodeError } from "@/lib/image-reencode";
import { ContentError } from "@/lib/content/util";
import type { ContentViewer } from "@/lib/content/permissions";

export async function currentViewer(): Promise<ContentViewer> {
  const u = await getCurrentUser();
  return u ? { id: u.id, role: u.role, isChef: u.isChef, chefCanPublish: u.chefCanPublish, disabled: u.disabled } : null;
}

/** Signed-in viewer or 401. */
export async function requireViewer(): Promise<NonNullable<ContentViewer>> {
  const v = await currentViewer();
  if (!v) throw new AuthError();
  return v;
}

export function contentErrorResponse(err: unknown, label: string) {
  if (err instanceof ContentError || err instanceof ImageReencodeError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof AuthError || err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) return NextResponse.json({ error: err.flatten() }, { status: 400 });
  console.error(label, err);
  return NextResponse.json({ error: "Failed" }, { status: 500 });
}
