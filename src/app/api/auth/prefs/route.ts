import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, getCurrentUser, publicUser, requireUser } from "@/lib/auth";
import {
  applyJewishHalalSupersede,
  applyPlantPrefToggle,
  effectiveObservant,
  normalizePlantPrefs,
} from "@/lib/dietary";

const prefsSchema = z.object({
  isJewish: z.boolean().optional(),
  isObservant: z.boolean().optional(),
  preferKosher: z.boolean().optional(),
  isMuslim: z.boolean().optional(),
  preferHalal: z.boolean().optional(),
  preferVegetarian: z.boolean().optional(),
  preferPescatarian: z.boolean().optional(),
  preferVegan: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = prefsSchema.parse(await req.json());

    const isJewish =
      body.isJewish !== undefined ? body.isJewish : Boolean(user.isJewish);
    let isObservant =
      body.isObservant !== undefined
        ? body.isObservant
        : Boolean(user.isObservant);
    // Observant without Jewish → treat as off
    if (!isJewish) isObservant = false;

    let isMuslim =
      body.isMuslim !== undefined ? body.isMuslim : Boolean(user.isMuslim);
    let preferHalal =
      body.preferHalal !== undefined
        ? body.preferHalal
        : Boolean(user.preferHalal);
    // Jewish supersedes Muslim/Halal — force clear when Jewish
    if (isJewish) {
      isMuslim = false;
      preferHalal = false;
    }

    let plant = {
      preferVegan: Boolean(user.preferVegan),
      preferVegetarian: Boolean(user.preferVegetarian),
      preferPescatarian: Boolean(user.preferPescatarian),
    };
    // Apply plant toggles in priority order if multiple sent
    if (body.preferVegan !== undefined) {
      plant = applyPlantPrefToggle(plant, "preferVegan", body.preferVegan);
    } else if (body.preferVegetarian !== undefined) {
      plant = applyPlantPrefToggle(
        plant,
        "preferVegetarian",
        body.preferVegetarian
      );
    } else if (body.preferPescatarian !== undefined) {
      plant = applyPlantPrefToggle(
        plant,
        "preferPescatarian",
        body.preferPescatarian
      );
    } else {
      plant = normalizePlantPrefs(plant);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        isJewish,
        isObservant,
        ...(body.preferKosher !== undefined
          ? { preferKosher: body.preferKosher }
          : {}),
        isMuslim,
        preferHalal,
        preferVegan: plant.preferVegan,
        preferVegetarian: plant.preferVegetarian,
        preferPescatarian: plant.preferPescatarian,
      },
      include: {
        memberships: {
          include: {
            household: {
              select: { id: true, name: true, inviteCode: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    void effectiveObservant(updated);
    void applyJewishHalalSupersede(updated);

    return NextResponse.json({ user: publicUser(updated as typeof user) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("auth/prefs PATCH", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  const plant = normalizePlantPrefs(user);
  return NextResponse.json({
    prefs: {
      isJewish: Boolean(user.isJewish),
      isObservant: Boolean(user.isObservant),
      preferKosher: Boolean(user.preferKosher),
      isMuslim: Boolean(user.isMuslim),
      preferHalal: Boolean(user.preferHalal),
      preferVegetarian: plant.preferVegetarian,
      preferPescatarian: plant.preferPescatarian,
      preferVegan: plant.preferVegan,
    },
  });
}
