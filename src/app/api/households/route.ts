import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  AuthError,
  generateInviteCode,
  requireUser,
} from "@/lib/auth";
import { cloneStapleRecipesToHousehold } from "@/lib/clone-staples";

const createSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET() {
  try {
    const user = await requireUser();
    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      include: {
        household: { select: { id: true, name: true, inviteCode: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(
      memberships.map((m) => ({
        id: m.household.id,
        name: m.household.name,
        inviteCode: m.household.inviteCode,
        role: m.role,
        membershipId: m.id,
      }))
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to list households" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = createSchema.parse(body);

    let inviteCode = generateInviteCode();
    for (let i = 0; i < 5; i++) {
      const clash = await prisma.household.findUnique({ where: { inviteCode } });
      if (!clash) break;
      inviteCode = generateInviteCode();
    }

    const household = await prisma.household.create({
      data: {
        name: data.name.trim(),
        inviteCode,
        members: {
          create: { userId: user.id, role: "owner" },
        },
      },
    });

    // Copy global staple/classic recipes into the new household starter pack
    let staplesCloned = 0;
    try {
      staplesCloned = await cloneStapleRecipesToHousehold(prisma, household.id);
    } catch (cloneErr) {
      console.error("households POST staple clone", cloneErr);
    }

    return NextResponse.json(
      {
        id: household.id,
        name: household.name,
        inviteCode: household.inviteCode,
        role: "owner",
        staplesCloned,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("households POST", err);
    return NextResponse.json({ error: "Failed to create household" }, { status: 500 });
  }
}
