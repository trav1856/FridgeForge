import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { resolveDietarySuggestOptions } from "@/lib/dietary";
import { householdWhere, recipeScopeWhere } from "@/lib/household";
import { toPantrySnapshot, toRecipeForMatch } from "@/lib/mappers";
import { dedupeRecipesByTitle } from "@/lib/dedupe-recipes";
import {
  buildWeeklyMenu,
  collectMissingFromPlan,
  regenerateMenuDay,
  regenerateMenuSlot,
  type MealSlot,
  type WeeklyMenuPlanData,
  MEAL_SLOTS,
} from "@/lib/weekly-menu";

async function loadMatchData(householdId: string | null) {
  const [pantryItems, recipes] = await Promise.all([
    prisma.pantryItem.findMany({ where: householdWhere(householdId) }),
    prisma.recipe.findMany({
      where: recipeScopeWhere(householdId),
      include: { ingredients: true },
    }),
  ]);
  const pantry = pantryItems.map(toPantrySnapshot);
  const recipeData = dedupeRecipesByTitle(recipes, householdId).map(
    toRecipeForMatch
  );
  return { pantry, recipeData };
}

function planWhere(householdId: string | null, userId: string | null) {
  if (householdId != null) return { householdId };
  if (userId != null) return { userId, householdId: null };
  return null;
}

async function findSavedPlan(householdId: string | null, userId: string | null) {
  const where = planWhere(householdId, userId);
  if (!where) return null;
  return prisma.weeklyMenuPlan.findFirst({
    where,
    orderBy: { updatedAt: "desc" },
  });
}

async function upsertPlan(
  householdId: string | null,
  userId: string | null,
  plan: WeeklyMenuPlanData
) {
  const where = planWhere(householdId, userId);
  if (!where) return null;
  const existing = await prisma.weeklyMenuPlan.findFirst({
    where,
    orderBy: { updatedAt: "desc" },
  });
  const data = {
    planJson: JSON.stringify(plan),
    struggleMode: plan.struggleMode,
    householdId,
    userId,
  };
  if (existing) {
    return prisma.weeklyMenuPlan.update({
      where: { id: existing.id },
      data: {
        planJson: data.planJson,
        struggleMode: data.struggleMode,
      },
    });
  }
  return prisma.weeklyMenuPlan.create({ data });
}

function parsePlanJson(raw: string): WeeklyMenuPlanData | null {
  try {
    const parsed = JSON.parse(raw) as WeeklyMenuPlanData;
    if (!parsed?.days || !Array.isArray(parsed.days)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const householdId = await resolveHouseholdId();
  const user = await getCurrentUser();
  const dietary = resolveDietarySuggestOptions(user);
  const struggleMode = req.nextUrl.searchParams.get("struggle") === "1";
  const regenerate = req.nextUrl.searchParams.get("regenerate") === "1";

  const { pantry, recipeData } = await loadMatchData(householdId);

  if (!regenerate) {
    const saved = await findSavedPlan(householdId, user?.id ?? null);
    if (saved) {
      const plan = parsePlanJson(saved.planJson);
      if (plan) {
        // If struggle flag differs from saved and caller asked for struggle, rebuild
        if (struggleMode === plan.struggleMode) {
          return NextResponse.json({
            plan,
            persisted: true,
            pantryCount: pantry.length,
            missing: collectMissingFromPlan(plan),
          });
        }
      }
    }
  }

  const plan = buildWeeklyMenu(recipeData, pantry, {
    struggleMode,
    ...dietary,
    maxMissing: 3,
    // First load without regenerate stays stable; ?regenerate=1 must vary
    randomize: regenerate,
  });
  const row = await upsertPlan(householdId, user?.id ?? null, plan);

  return NextResponse.json({
    plan,
    persisted: Boolean(row),
    pantryCount: pantry.length,
    missing: collectMissingFromPlan(plan),
  });
}

const postSchema = z.object({
  action: z.enum(["regenerate", "regenerateSlot", "regenerateDay", "save"]),
  struggleMode: z.boolean().optional(),
  dayIndex: z.number().int().min(0).max(6).optional(),
  slot: z.enum(["breakfast", "lunch", "dinner"]).optional(),
  plan: z.any().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const householdId = await resolveHouseholdId();
    const user = await getCurrentUser();
    const dietary = resolveDietarySuggestOptions(user);
    const body = postSchema.parse(await req.json());
    const { pantry, recipeData } = await loadMatchData(householdId);
    const struggleMode = Boolean(body.struggleMode);

    let plan: WeeklyMenuPlanData;

    if (body.action === "regenerate") {
      plan = buildWeeklyMenu(recipeData, pantry, {
        struggleMode,
        ...dietary,
        maxMissing: 3,
        randomize: true,
      });
    } else if (body.action === "regenerateSlot") {
      if (body.dayIndex == null || !body.slot) {
        return NextResponse.json(
          { error: "dayIndex and slot required" },
          { status: 400 }
        );
      }
      const slot = body.slot as MealSlot;
      if (!MEAL_SLOTS.includes(slot)) {
        return NextResponse.json({ error: "invalid slot" }, { status: 400 });
      }
      let base: WeeklyMenuPlanData | null = null;
      if (body.plan) {
        base = body.plan as WeeklyMenuPlanData;
      } else {
        const saved = await findSavedPlan(householdId, user?.id ?? null);
        base = saved ? parsePlanJson(saved.planJson) : null;
      }
      if (!base) {
        base = buildWeeklyMenu(recipeData, pantry, {
          struggleMode,
          ...dietary,
          maxMissing: 3,
          randomize: true,
        });
      }
      plan = regenerateMenuSlot(
        base,
        body.dayIndex,
        slot,
        recipeData,
        pantry,
        { struggleMode, ...dietary, maxMissing: 3, randomize: true }
      );
    } else if (body.action === "regenerateDay") {
      if (body.dayIndex == null) {
        return NextResponse.json(
          { error: "dayIndex required" },
          { status: 400 }
        );
      }
      let base: WeeklyMenuPlanData | null = null;
      if (body.plan) {
        base = body.plan as WeeklyMenuPlanData;
      } else {
        const saved = await findSavedPlan(householdId, user?.id ?? null);
        base = saved ? parsePlanJson(saved.planJson) : null;
      }
      if (!base) {
        base = buildWeeklyMenu(recipeData, pantry, {
          struggleMode,
          ...dietary,
          maxMissing: 3,
          randomize: true,
        });
      }
      plan = regenerateMenuDay(
        base,
        body.dayIndex,
        recipeData,
        pantry,
        { struggleMode, ...dietary, maxMissing: 3, randomize: true }
      );
    } else {
      // save
      if (!body.plan) {
        return NextResponse.json({ error: "plan required" }, { status: 400 });
      }
      plan = body.plan as WeeklyMenuPlanData;
    }

    const row = await upsertPlan(householdId, user?.id ?? null, plan);

    return NextResponse.json({
      plan,
      persisted: Boolean(row),
      pantryCount: pantry.length,
      missing: collectMissingFromPlan(plan),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
