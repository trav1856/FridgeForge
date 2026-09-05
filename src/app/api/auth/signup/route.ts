import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  AuthError,
  createSession,
  getCurrentUser,
  hashPassword,
  publicUser,
} from "@/lib/auth";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const email = data.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(data.password);
    const created = await prisma.user.create({
      data: {
        email,
        name: data.name?.trim() || null,
        passwordHash,
        plan: "community",
      },
    });

    await createSession(created.id);
    const user = await getCurrentUser();
    if (!user) throw new AuthError("Session failed");
    return NextResponse.json(publicUser(user), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("signup", err);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
