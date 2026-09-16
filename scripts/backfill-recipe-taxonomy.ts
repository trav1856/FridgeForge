/**
 * Non-destructive taxonomy backfill for recipes with null/empty cuisine
 * (and missing meatType when meat is present).
 *
 * Usage (on Corelia with DB access):
 *   npx tsx scripts/backfill-recipe-taxonomy.ts           # dry-run
 *   npx tsx scripts/backfill-recipe-taxonomy.ts --apply    # write
 */
import { PrismaClient } from "@prisma/client";
import {
  ensureParentCuisineOrigins,
  inferRecipeTaxonomy,
  normalizeCuisine,
  normalizeMeatType,
} from "../src/lib/recipe-taxonomy";
import { parseStringArray, stringifyArray } from "../src/lib/json";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      steps: true,
      cuisine: true,
      course: true,
      foodCategories: true,
      origins: true,
      meatType: true,
      ingredients: { select: { name: true } },
    },
  });

  let cuisineUpdated = 0;
  let meatUpdated = 0;
  let originsTouched = 0;
  const spot: { title: string; cuisine: string | null; meatType: string | null }[] =
    [];

  for (const r of recipes) {
    const cuisineBlank = !(r.cuisine && r.cuisine.trim());
    const cats = parseStringArray(r.foodCategories);
    const hasMeat = cats.map((c) => c.toLowerCase()).includes("meat");
    const meatBlank = !(r.meatType && r.meatType.trim());

    if (!cuisineBlank && !(hasMeat && meatBlank) && !cuisineBlank) {
      // Still may need Asian parent origins for East/SE children
    }

    const inferred = inferRecipeTaxonomy({
      title: r.title,
      description: r.description,
      tags: parseStringArray(r.tags),
      ingredients: r.ingredients,
      steps: parseStringArray(r.steps),
    });

    const data: {
      cuisine?: string | null;
      course?: string | null;
      foodCategories?: string;
      origins?: string;
      meatType?: string | null;
    } = {};

    if (cuisineBlank) {
      data.cuisine = inferred.cuisine;
      if (!(r.course && r.course.trim())) data.course = inferred.course;
      if (!cats.length) data.foodCategories = stringifyArray(inferred.foodCategories);
      const origins = parseStringArray(r.origins);
      if (!origins.length) {
        data.origins = stringifyArray(
          ensureParentCuisineOrigins(inferred.cuisine, inferred.origins)
        );
      } else {
        const next = ensureParentCuisineOrigins(inferred.cuisine, origins);
        if (next.length !== origins.length) {
          data.origins = stringifyArray(next);
        }
      }
      if (inferred.meatType && meatBlank) {
        data.meatType = inferred.meatType;
        const nextCats = parseStringArray(
          data.foodCategories ?? r.foodCategories
        );
        if (!nextCats.includes("meat")) {
          data.foodCategories = stringifyArray([...nextCats, "meat"]);
        }
      }
    } else {
      // Cuisine present: ensure Asian parent origins for child cuisines
      const c = normalizeCuisine(r.cuisine);
      const origins = parseStringArray(r.origins);
      const next = ensureParentCuisineOrigins(c, origins);
      if (JSON.stringify(next) !== JSON.stringify(origins)) {
        data.origins = stringifyArray(next);
      }
      if ((hasMeat || inferred.meatType) && meatBlank && inferred.meatType) {
        data.meatType = inferred.meatType;
        if (!hasMeat) {
          data.foodCategories = stringifyArray([...cats, "meat"]);
        }
      }
    }

    // Clear meatType if not meat
    const finalCats = parseStringArray(
      data.foodCategories ?? r.foodCategories
    );
    if (
      !finalCats.includes("meat") &&
      r.meatType &&
      normalizeMeatType(r.meatType)
    ) {
      // leave existing unless we're writing other fields — non-destructive: skip
    }

    if (!Object.keys(data).length) continue;

    const nextCuisine = data.cuisine ?? r.cuisine;
    const nextMeat = data.meatType ?? r.meatType;
    console.log(
      `${apply ? "APPLY" : "DRY"} ${r.title} → cuisine=${nextCuisine} meatType=${nextMeat ?? "—"} keys=${Object.keys(data).join(",")}`
    );

    if (data.cuisine !== undefined) cuisineUpdated++;
    if (data.meatType !== undefined) meatUpdated++;
    if (data.origins !== undefined) originsTouched++;

    if (
      /bulgogi|kimchi|empanada|hamantasch|apple cake/i.test(r.title) ||
      cuisineBlank
    ) {
      spot.push({
        title: r.title,
        cuisine: nextCuisine,
        meatType: nextMeat ?? null,
      });
    }

    if (apply) {
      await prisma.recipe.update({ where: { id: r.id }, data });
    }
  }

  console.log(
    JSON.stringify(
      {
        apply,
        scanned: recipes.length,
        cuisineUpdated,
        meatUpdated,
        originsTouched,
        spotCheck: spot.slice(0, 20),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
