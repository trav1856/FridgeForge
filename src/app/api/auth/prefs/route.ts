import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, getCurrentUser, publicUser, requireUser } from "@/lib/auth";
import { effectiveObservant } from "@/lib/dietary";

const prefsSchema = z.object({
  isJewish: z.boolean().optional(),
  isObservant: z.boolean().optional(),
  preferKosher: z.boolean().optional(),
  preferHalal: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = prefsSchema.parse(await req.json());

    const isJewish =
      body.isJewish !== undefined ? body.isJewish : Boolean(user.isJewish);
    let isObservant =
      body.isObservant !== undefined
        ? body.isObservant
        : Boolean(user.isObservant);
    // Observant without Jewish → treat as off
    if (!isJewish) isObservant = false;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        isJewish,
        isObservant,
        ...(body.preferKosher !== undefined
          ? { preferKosher: body.preferKosher }
          : {}),
        ...(body.preferHalal !== undefined
          ? { preferHalal: body.preferHalal }
          : {}),
      },
      include: {
        memberships: {
          include: {
            household: {
              select: { id: true, name: true, inviteCode: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Mirror effective observant into response shape (already enforced in DB write)
    void effectiveObservant(updated);

    return NextResponse.json({ user: publicUser(updated as typeof user) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("auth/prefs PATCH", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    prefs: {
      isJewish: Boolean(user.isJewish),
      isObservant: Boolean(user.isObservant),
      preferKosher: Boolean(user.preferKosher),
      preferHalal: Boolean(user.preferHalal),
    },
  });
}
