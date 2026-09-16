import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, getCurrentUser, publicUser, requireUser } from "@/lib/auth";
import {
  applyKosherHalalSupersede,
  applyMacroPrefToggle,
  applyPlantPrefToggle,
  effectiveObservant,
  kosherFoodActive,
  normalizePlantPrefs,
  type MacroPrefKey,
} from "@/lib/dietary";
import { parseAllergenList } from "@/lib/allergens";
import { stringifyArray } from "@/lib/json";

const prefsSchema = z.object({
  isJewish: z.boolean().optional(),
  isObservant: z.boolean().optional(),
  preferKosher: z.boolean().optional(),
  isMuslim: z.boolean().optional(),
  preferHalal: z.boolean().optional(),
  preferVegetarian: z.boolean().optional(),
  preferPescatarian: z.boolean().optional(),
  preferVegan: z.boolean().optional(),
  preferCarnivore: z.boolean().optional(),
  preferAtkins: z.boolean().optional(),
  preferLowCarb: z.boolean().optional(),
  preferLowSugar: z.boolean().optional(),
  preferLowSodium: z.boolean().optional(),
  allergenFlags: z.array(z.string().max(64)).max(40).optional(),
});

const MACRO_KEYS: MacroPrefKey[] = [
  "preferCarnivore",
  "preferAtkins",
  "preferLowCarb",
  "preferLowSugar",
  "preferLowSodium",
];

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

    const preferKosher =
      body.preferKosher !== undefined
        ? body.preferKosher
        : Boolean(user.preferKosher);

    const isMuslim =
      body.isMuslim !== undefined ? body.isMuslim : Boolean(user.isMuslim);
    let preferHalal =
      body.preferHalal !== undefined
        ? body.preferHalal
        : Boolean(user.preferHalal);
    // Kosher food supersedes Halal food — clear preferHalal when preferKosher or Observant.
    // Do not force isMuslim off for isJewish (religion ≠ food).
    if (preferKosher || (isJewish && isObservant)) {
      preferHalal = false;
    }

    let plant = {
      preferVegan: Boolean(user.preferVegan),
      preferVegetarian: Boolean(user.preferVegetarian),
      preferPescatarian: Boolean(user.preferPescatarian),
      preferCarnivore: Boolean(user.preferCarnivore),
    };
    let macros = {
      preferCarnivore: Boolean(user.preferCarnivore),
      preferAtkins: Boolean(user.preferAtkins),
      preferLowCarb: Boolean(user.preferLowCarb),
      preferLowSugar: Boolean(user.preferLowSugar),
      preferLowSodium: Boolean(user.preferLowSodium),
      preferVegan: Boolean(user.preferVegan),
      preferVegetarian: Boolean(user.preferVegetarian),
      preferPescatarian: Boolean(user.preferPescatarian),
    };

    // Plant toggles first (clear carnivore when plant on)
    if (body.preferVegan !== undefined) {
      plant = applyPlantPrefToggle(plant, "preferVegan", body.preferVegan);
      macros.preferVegan = plant.preferVegan;
      macros.preferVegetarian = plant.preferVegetarian;
      macros.preferPescatarian = plant.preferPescatarian;
      macros.preferCarnivore = plant.preferCarnivore;
    } else if (body.preferVegetarian !== undefined) {
      plant = applyPlantPrefToggle(
        plant,
        "preferVegetarian",
        body.preferVegetarian
      );
      macros.preferVegan = plant.preferVegan;
      macros.preferVegetarian = plant.preferVegetarian;
      macros.preferPescatarian = plant.preferPescatarian;
      macros.preferCarnivore = plant.preferCarnivore;
    } else if (body.preferPescatarian !== undefined) {
      plant = applyPlantPrefToggle(
        plant,
        "preferPescatarian",
        body.preferPescatarian
      );
      macros.preferVegan = plant.preferVegan;
      macros.preferVegetarian = plant.preferVegetarian;
      macros.preferPescatarian = plant.preferPescatarian;
      macros.preferCarnivore = plant.preferCarnivore;
    } else {
      const n = normalizePlantPrefs(plant);
      plant = { ...n, preferCarnivore: plant.preferCarnivore };
      macros.preferVegan = n.preferVegan;
      macros.preferVegetarian = n.preferVegetarian;
      macros.preferPescatarian = n.preferPescatarian;
    }

    // Macro toggles (carnivore clears plant)
    for (const key of MACRO_KEYS) {
      if (body[key] !== undefined) {
        macros = {
          ...macros,
          ...applyMacroPrefToggle(macros, key, Boolean(body[key])),
        };
      }
    }

    // Final exclusivity: carnivore clears plant; plant primary clears carnivore
    if (macros.preferCarnivore) {
      macros.preferVegan = false;
      macros.preferVegetarian = false;
      macros.preferPescatarian = false;
    } else {
      const n = normalizePlantPrefs(macros);
      macros.preferVegan = n.preferVegan;
      macros.preferVegetarian = n.preferVegetarian;
      macros.preferPescatarian = n.preferPescatarian;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        isJewish,
        isObservant,
        preferKosher,
        isMuslim,
        preferHalal,
        preferVegan: macros.preferVegan,
        preferVegetarian: macros.preferVegetarian,
        preferPescatarian: macros.preferPescatarian,
        preferCarnivore: macros.preferCarnivore,
        preferAtkins: macros.preferAtkins,
        preferLowCarb: macros.preferLowCarb,
        preferLowSugar: macros.preferLowSugar,
        preferLowSodium: macros.preferLowSodium,
        ...(body.allergenFlags !== undefined
          ? {
              allergenFlags: stringifyArray(
                parseAllergenList(body.allergenFlags)
              ),
            }
          : {}),
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
    void applyKosherHalalSupersede(updated);
    void kosherFoodActive(updated);

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
  const carnivore = Boolean(user.preferCarnivore);
  return NextResponse.json({
    prefs: {
      isJewish: Boolean(user.isJewish),
      isObservant: Boolean(user.isObservant),
      preferKosher: Boolean(user.preferKosher),
      isMuslim: Boolean(user.isMuslim),
      preferHalal: Boolean(user.preferHalal),
      preferVegetarian: carnivore ? false : plant.preferVegetarian,
      preferPescatarian: carnivore ? false : plant.preferPescatarian,
      preferVegan: carnivore ? false : plant.preferVegan,
      preferCarnivore: carnivore,
      preferAtkins: Boolean(user.preferAtkins),
      preferLowCarb: Boolean(user.preferLowCarb),
      preferLowSugar: Boolean(user.preferLowSugar),
      preferLowSodium: Boolean(user.preferLowSodium),
      allergenFlags: parseAllergenList(
        (user as { allergenFlags?: string | null }).allergenFlags
      ),
    },
  });
}
