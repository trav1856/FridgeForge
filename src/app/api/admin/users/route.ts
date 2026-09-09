import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        disabled: true,
        createdAt: true,
        _count: { select: { memberships: true, reviews: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        role: u.role,
        disabled: u.disabled,
        createdAt: u.createdAt.toISOString(),
        householdCount: u._count.memberships,
        reviewCount: u._count.reviews,
      })),
    });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/users GET", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "admin"]).optional(),
  disabled: z.boolean().optional(),
  plan: z.enum(["community", "pro"]).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const data = patchSchema.parse(await req.json());
    if (data.id === admin.id && data.role === "user") {
      return NextResponse.json(
        { error: "Cannot demote yourself" },
        { status: 400 }
      );
    }
    if (data.id === admin.id && data.disabled === true) {
      return NextResponse.json(
        { error: "Cannot disable yourself" },
        { status: 400 }
      );
    }
    const existing = await prisma.user.findUnique({ where: { id: data.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { id, ...rest } = data;
    const updated = await prisma.user.update({
      where: { id },
      data: rest,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        disabled: true,
      },
    });
    if (rest.disabled === true) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/users PATCH", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
