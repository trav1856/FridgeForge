import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { passwordSchema } from "@/lib/password-rules";
import { consumeResetToken } from "@/lib/password-reset";
import { isSameOriginRequest } from "@/lib/same-origin";

const schema = z.object({
  token: z.string().min(1).max(200),
  password: passwordSchema,
});

/** Public: set a new password from an admin-issued one-time link. */
export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
    const data = schema.parse(await req.json());
    const passwordHash = await hashPassword(data.password);
    const result = await prisma.$transaction((tx) =>
      consumeResetToken(tx, data.token, passwordHash)
    );
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.error === "expired"
              ? "This reset link has expired. Ask an admin for a new one."
              : "This reset link is invalid or was already used.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("reset-password", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
