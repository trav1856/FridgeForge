import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { approveAllPendingForRecipe } from "@/lib/recipe-request-actions";

const bodySchema = z.object({
  recipeId: z.string().min(1),
});

/**
 * POST — accept every pending inbound "Can I have that?" request for one
 * recipe owned/addressed to the signed-in user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const body = bodySchema.parse(await req.json());
    const result = await approveAllPendingForRecipe(body.recipeId, user.id);
    return NextResponse.json({
      ok: true,
      approved: result.approved,
      recipeIds: result.recipeIds,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Bulk accept failed" }, { status: 500 });
  }
}
