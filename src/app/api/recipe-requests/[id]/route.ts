import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, getCurrentUser } from "@/lib/auth";
import {
  acceptOwnedRecipeRequest,
  declineOwnedRecipeRequest,
} from "@/lib/recipe-request-actions";

type Ctx = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const { id } = await ctx.params;
    const { action } = actionSchema.parse(await req.json());

    if (action === "decline") {
      const result = await declineOwnedRecipeRequest(id, user.id);
      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error,
            ...(result.requestStatus ? { status: result.requestStatus } : {}),
          },
          { status: result.status }
        );
      }
      return NextResponse.json({ ok: true, status: "declined" });
    }

    const result = await acceptOwnedRecipeRequest(id, user.id);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.requestStatus ? { status: result.requestStatus } : {}),
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "accepted",
      recipeId: result.recipeId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
