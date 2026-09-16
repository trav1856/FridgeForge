/**
 * One-shot non-destructive: decode HTML entities in recipe titles (and
 * description/steps/ingredient names when clearly encoded).
 *
 * Run on Corelia with DB access:
 *   cd /Users/trav/FridgeForge && npx tsx scripts/fix-html-entity-titles.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  decodeHtmlEntities,
  decodeHtmlEntitiesNullable,
} from "../src/lib/html-entities";

const prisma = new PrismaClient();

function needsDecode(s: string | null | undefined): boolean {
  return Boolean(s && /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(s));
}

async function main() {
  const candidates = await prisma.recipe.findMany({
    where: {
      OR: [
        { title: { contains: "&#" } },
        { title: { contains: "&amp;" } },
        { title: { contains: "&quot;" } },
        { title: { contains: "Bubbie", mode: "insensitive" } },
        { title: { contains: "Hamantaschen", mode: "insensitive" } },
      ],
    },
    include: { ingredients: true },
  });

  let updated = 0;
  for (const r of candidates) {
    const title = decodeHtmlEntities(r.title);
    const description = needsDecode(r.description)
      ? decodeHtmlEntitiesNullable(r.description)
      : r.description;
    const stepsRaw = r.steps || "[]";
    let steps = stepsRaw;
    try {
      const arr = JSON.parse(stepsRaw) as unknown;
      if (Array.isArray(arr) && arr.some((x) => typeof x === "string" && needsDecode(x))) {
        steps = JSON.stringify(
          arr.map((x) => (typeof x === "string" ? decodeHtmlEntities(x) : x))
        );
      }
    } catch {
      /* leave */
    }

    const titleChanged = title !== r.title;
    const descChanged = description !== r.description;
    const stepsChanged = steps !== stepsRaw;

    const ingUpdates: { id: string; name: string }[] = [];
    for (const ing of r.ingredients) {
      if (needsDecode(ing.name)) {
        const name = decodeHtmlEntities(ing.name);
        if (name !== ing.name) ingUpdates.push({ id: ing.id, name });
      }
    }

    if (!titleChanged && !descChanged && !stepsChanged && !ingUpdates.length) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      if (titleChanged || descChanged || stepsChanged) {
        await tx.recipe.update({
          where: { id: r.id },
          data: {
            ...(titleChanged ? { title } : {}),
            ...(descChanged ? { description } : {}),
            ...(stepsChanged ? { steps } : {}),
          },
        });
      }
      for (const u of ingUpdates) {
        await tx.recipeIngredient.update({
          where: { id: u.id },
          data: { name: u.name },
        });
      }
    });

    updated += 1;
    console.log(
      `fixed ${r.id}: ${JSON.stringify(r.title)} → ${JSON.stringify(title)}`
    );
  }

  console.log(`Done. Updated ${updated} recipe(s) of ${candidates.length} candidates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
