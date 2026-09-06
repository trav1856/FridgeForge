import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const { id: recipeId } = await ctx.params;
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = schema.parse(await req.json());
    const email = body.email.trim().toLowerCase();
    const toUser = await prisma.user.findUnique({ where: { email } });
    const share = await prisma.recipeShare.create({
      data: {
        recipeId,
        fromUserId: user.id,
        toUserEmail: email,
        toUserId: toUser?.id ?? null,
      },
    });
    return NextResponse.json({ share }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Sign in to share" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to share" }, { status: 500 });
  }
}
