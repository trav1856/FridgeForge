import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";

const itemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().positive().optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  recipeId: z.string().optional().nullable(),
  recipeTitle: z.string().max(200).optional().nullable(),
});

const postSchema = z.object({
  items: z.array(itemSchema).min(1).max(100),
});

const GUEST_LIST_MESSAGE =
  "Guest shopping lists are kept in this browser. Sign in to save yours.";

/** Guests keep their list in localStorage; the server never stores anonymous rows. */
function guestListBlocked() {
  return NextResponse.json(
    { error: GUEST_LIST_MESSAGE, code: "SIGN_IN_REQUIRED" },
    { status: 401 }
  );
}

export async function GET() {
  const householdId = await resolveHouseholdId();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [], local: true });
  const where =
    householdId != null
      ? { householdId }
      : { userId: user.id, householdId: null };

  const items = await prisma.shoppingListItem.findMany({
    where,
    orderBy: [{ checked: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    const householdId = await resolveHouseholdId();
    const user = await getCurrentUser();
    if (!user) return guestListBlocked();
    const body = postSchema.parse(await req.json());
    let added = 0;
    for (const item of body.items) {
      const name = item.name.trim();
      if (!name) continue;
      const existing = await prisma.shoppingListItem.findFirst({
        where: {
          name: { equals: name },
          checked: false,
          ...(householdId != null
            ? { householdId }
            : { userId: user.id, householdId: null }),
        },
      });
      if (existing) continue;
      await prisma.shoppingListItem.create({
        data: {
          name,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          recipeId: item.recipeId ?? null,
          recipeTitle: item.recipeTitle ?? null,
          householdId,
          userId: user.id,
        },
      });
      added += 1;
    }
    return NextResponse.json({ ok: true, added }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to add" }, { status: 500 });
  }
}

export async function DELETE() {
  const householdId = await resolveHouseholdId();
  const user = await getCurrentUser();
  if (!user) return guestListBlocked();
  const where =
    householdId != null
      ? { householdId, checked: true }
      : { userId: user.id, householdId: null, checked: true };
  const result = await prisma.shoppingListItem.deleteMany({ where });
  return NextResponse.json({ ok: true, deleted: result.count });
}
