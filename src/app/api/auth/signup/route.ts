import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  AuthError,
  createSession,
  generateInviteCode,
  getCurrentUser,
  hashPassword,
  publicUser,
} from "@/lib/auth";
import { allocateProfileSlugForCreate } from "@/lib/public-profile";
import { recordSignIn } from "@/lib/activity";
import { passwordSchema } from "@/lib/password-rules";
import { personalKitchenName } from "@/lib/household";
import { AGE_BLOCK_COOKIE, AGE_BLOCK_SECONDS, checkMinAge } from "@/lib/age-gate";

const schema = z.object({
  email: z.string().email().max(200),
  password: passwordSchema,
  name: z.string().min(1).max(120).optional(),
  /** YYYY-MM-DD. Checked against the minimum age, never stored. */
  birthDate: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    // Age gate (13+). Only the confirmation time is kept, not the date of birth.
    const underAgeMsg = "Sorry, you need to be 13 or older to create a FridgeForge account.";
    if (req.cookies.get(AGE_BLOCK_COOKIE)) {
      return NextResponse.json({ error: underAgeMsg, code: "UNDER_MIN_AGE" }, { status: 403 });
    }
    const age = checkMinAge(data.birthDate);
    if (!age.ok) {
      if (age.code === "UNDER_MIN_AGE") {
        const res = NextResponse.json({ error: underAgeMsg, code: age.code }, { status: 403 });
        res.cookies.set(AGE_BLOCK_COOKIE, "1", {
          httpOnly: true,
          sameSite: "lax",
          maxAge: AGE_BLOCK_SECONDS,
          path: "/",
        });
        return res;
      }
      return NextResponse.json({ error: age.error, code: age.code }, { status: 400 });
    }
    const email = data.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(data.password);
    const profileSlug = await allocateProfileSlugForCreate();
    const name = data.name?.trim() || null;
    // Every new account gets its own empty household so it never shares the
    // guest/demo pantry or anyone else's. No items are copied in.
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          profileSlug,
          passwordHash,
          plan: "free",
          ageConfirmedAt: new Date(),
        },
      });
      let inviteCode = generateInviteCode();
      for (let i = 0; i < 5; i++) {
        const clash = await tx.household.findUnique({ where: { inviteCode } });
        if (!clash) break;
        inviteCode = generateInviteCode();
      }
      await tx.household.create({
        data: {
          name: personalKitchenName(name, email),
          inviteCode,
          members: { create: { userId: user.id, role: "owner" } },
        },
      });
      return user;
    });

    await createSession(created.id);
    await recordSignIn(created.id).catch((e) => console.error("signup activity", e));
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
