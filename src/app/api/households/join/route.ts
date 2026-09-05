import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireUser } from "@/lib/auth";

const schema = z.object({
  inviteCode: z.string().min(4).max(32),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = schema.parse(body);
    const code = data.inviteCode.trim().toUpperCase();

    const household = await prisma.household.findUnique({
      where: { inviteCode: code },
    });
    if (!household) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    const existing = await prisma.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId: household.id,
          userId: user.id,
        },
      },
    });
    if (existing) {
      return NextResponse.json({
        id: household.id,
        name: household.name,
        inviteCode: household.inviteCode,
        role: existing.role,
        alreadyMember: true,
      });
    }

    const member = await prisma.householdMember.create({
      data: {
        householdId: household.id,
        userId: user.id,
        role: "member",
      },
    });

    return NextResponse.json(
      {
        id: household.id,
        name: household.name,
        inviteCode: household.inviteCode,
        role: member.role,
        alreadyMember: false,
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
    console.error("households join", err);
    return NextResponse.json({ error: "Failed to join household" }, { status: 500 });
  }
}
