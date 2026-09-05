import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  AuthError,
  createSession,
  getCurrentUser,
  publicUser,
  verifyPassword,
} from "@/lib/auth";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const email = data.email.trim().toLowerCase();

    const userRow = await prisma.user.findUnique({ where: { email } });
    if (!userRow?.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
    const ok = await verifyPassword(data.password, userRow.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await createSession(userRow.id);
    const user = await getCurrentUser();
    if (!user) throw new AuthError("Session failed");
    return NextResponse.json(publicUser(user));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("signin", err);
    return NextResponse.json({ error: "Sign in failed" }, { status: 500 });
  }
}
