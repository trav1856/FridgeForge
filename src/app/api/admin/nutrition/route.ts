import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { writeAudit } from "@/lib/admin-users";
import { ensureSnapshots, loadAllRecipesForSnapshots, setServingsSuspect } from "@/lib/nutrition/snapshot";
import { adminNutritionSchema } from "@/lib/nutrition/schema";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    const body = adminNutritionSchema.parse(await req.json());
    if (body.action === "recompute") {
      const recipes = await loadAllRecipesForSnapshots();
      const { snapshots, recomputed } = await ensureSnapshots(recipes, { force: true });
      const trusted = [...snapshots.values()].filter((s) => s.trusted).length;
      await writeAudit(prisma, { actorId: admin.id, targetUserId: null, action: "nutrition.recompute", details: { recipes: recipes.length, recomputed, trusted } });
      return NextResponse.json({ recipes: recipes.length, recomputed, trusted });
    }
    const snap = await setServingsSuspect(body.recipeId, body.suspect, body.note?.trim() || null);
    if (!snap) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    await writeAudit(prisma, { actorId: admin.id, targetUserId: null, action: "nutrition.servings_flag", details: { recipeId: body.recipeId, suspect: body.suspect } });
    return NextResponse.json({ snapshot: { recipeId: snap.recipeId, trusted: snap.trusted, servingsSuspect: snap.servingsSuspect } });
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/nutrition POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
