/**
 * Non-destructive backfill: fill empty kosherAdaptNote (and vegetarianAdaptNote)
 * on meat+dairy / meat recipes using inferAdaptNotes.
 *
 * Does NOT overwrite existing notes or change eligibility flags (admin may have
 * overridden those). Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/backfill-kosher-adapt-notes.ts           # dry-run
 *   npx tsx scripts/backfill-kosher-adapt-notes.ts --apply   # write
 */
import { PrismaClient } from "@prisma/client";
import {
  inferAdaptNotes,
  recipeHasMeatAndDairy,
} from "../src/lib/dietary";
import { parseStringArray } from "../src/lib/json";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

type Ing = { name: string };

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      steps: true,
      kosherAdaptNote: true,
      vegetarianAdaptNote: true,
      kosherEligible: true,
      vegetarianEligible: true,
      ingredients: { select: { name: true } },
    },
  });

  let kosherFilled = 0;
  let vegFilled = 0;
  let scanned = 0;

  for (const r of recipes) {
    scanned++;
    const ingredients = (r.ingredients as Ing[]).map((i) => ({ name: i.name }));
    const input = {
      title: r.title,
      description: r.description,
      tags: parseStringArray(r.tags),
      ingredients,
      steps: parseStringArray(r.steps),
    };
    const notes = inferAdaptNotes(input);
    const data: {
      kosherAdaptNote?: string;
      vegetarianAdaptNote?: string;
    } = {};

    const emptyKosher = !(r.kosherAdaptNote && r.kosherAdaptNote.trim());
    if (
      emptyKosher &&
      notes.kosherAdaptNote &&
      (recipeHasMeatAndDairy(input) || !r.kosherEligible)
    ) {
      // Prefer meat+dairy fills; also fill other empty adapt notes when
      // recipe is already marked not kosherEligible (still non-destructive).
      if (recipeHasMeatAndDairy(input) || !r.kosherEligible) {
        data.kosherAdaptNote = notes.kosherAdaptNote;
      }
    }

    const emptyVeg = !(r.vegetarianAdaptNote && r.vegetarianAdaptNote.trim());
    if (emptyVeg && notes.vegetarianAdaptNote && !r.vegetarianEligible) {
      data.vegetarianAdaptNote = notes.vegetarianAdaptNote;
    }

    if (!Object.keys(data).length) continue;

    console.log(
      `${apply ? "UPDATE" : "DRY"} ${r.id} "${r.title}" → ${JSON.stringify(data)}`
    );
    if (data.kosherAdaptNote) kosherFilled++;
    if (data.vegetarianAdaptNote) vegFilled++;

    if (apply) {
      await prisma.recipe.update({ where: { id: r.id }, data });
    }
  }

  console.log(
    `\nScanned ${scanned}. Would fill kosherAdaptNote=${kosherFilled}, vegetarianAdaptNote=${vegFilled}.` +
      (apply ? " Applied." : " Dry-run only (pass --apply to write).")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
