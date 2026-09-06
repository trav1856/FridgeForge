import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveHouseholdId } from "@/lib/auth";
import {
  listCustomStaples,
  upsertCustomStaple,
} from "@/lib/custom-staples";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  measureKind: z.string().max(40).optional().nullable(),
  suggestedUnit: z.string().max(40).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const householdId = await resolveHouseholdId();
  const category = req.nextUrl.searchParams.get("category") || undefined;
  const includeHidden =
    req.nextUrl.searchParams.get("includeHidden") === "1" ||
    req.nextUrl.searchParams.get("includeHidden") === "true";
  const staples = await listCustomStaples(householdId, {
    category,
    includeHidden,
  });
  return NextResponse.json(staples);
}

export async function POST(req: NextRequest) {
  try {
    const householdId = await resolveHouseholdId();
    const body = await req.json();
    const data = createSchema.parse(body);
    const staple = await upsertCustomStaple(data, householdId);
    if (!staple) {
      return NextResponse.json(
        { error: "Name is already in the static catalog or invalid" },
        { status: 400 }
      );
    }
    return NextResponse.json(staple, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("staples POST", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
