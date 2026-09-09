/**
 * One-time: delete household recipe copies that duplicate the shared catalog
 * (householdId null) for staple/classic titles.
 *
 * Keeps:
 * - All shared catalog rows (householdId null)
 * - Household recipes with unique titles (user-created)
 *
 * Deletes:
 * - Household recipes whose normalized title matches a shared recipe AND
 *   (household or shared tags include staple/classic, OR title matches a
 *   shared staple/classic exactly)
 *
 * Ingredients / favorites / shares / requests cascade via Prisma schema.
 *
 * Usage (Corelia, against Endor DATABASE_URL):
 *   npx tsx prisma/dedupe-household-staple-clones.ts
 * Dry run:
 *   DRY_RUN=1 npx tsx prisma/dedupe-household-staple-clones.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  isStapleOrClassicTagJson,
} from "../src/lib/clone-staples";
import { normalizeRecipeTitle } from "../src/lib/dedupe-recipes";

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === "1";

async function main() {
  const shared = await prisma.recipe.findMany({
    where: { householdId: null },
    select: { id: true, title: true, tags: true },
  });

  const sharedByTitle = new Map(
    shared.map((r) => [normalizeRecipeTitle(r.title), r])
  );
  const sharedStapleTitles = new Set(
    shared
      .filter((r) => isStapleOrClassicTagJson(r.tags))
      .map((r) => normalizeRecipeTitle(r.title))
  );

  const households = await prisma.household.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let totalDeleted = 0;
  const perHousehold: { name: string; id: string; deleted: number; titles: string[] }[] = [];

  for (const h of households) {
    const hhRecipes = await prisma.recipe.findMany({
      where: { householdId: h.id },
      select: { id: true, title: true, tags: true },
    });

    const toDelete = hhRecipes.filter((r) => {
      const key = normalizeRecipeTitle(r.title);
      const sharedMatch = sharedByTitle.get(key);
      if (!sharedMatch) return false;
      return (
        isStapleOrClassicTagJson(r.tags) ||
        isStapleOrClassicTagJson(sharedMatch.tags) ||
        sharedStapleTitles.has(key)
      );
    });

    if (toDelete.length === 0) {
      perHousehold.push({ name: h.name, id: h.id, deleted: 0, titles: [] });
      continue;
    }

    if (!dryRun) {
      await prisma.recipe.deleteMany({
        where: { id: { in: toDelete.map((r) => r.id) } },
      });
    }

    totalDeleted += toDelete.length;
    perHousehold.push({
      name: h.name,
      id: h.id,
      deleted: toDelete.length,
      titles: toDelete.map((r) => r.title),
    });
  }

  console.log(
    dryRun
      ? `DRY_RUN=1 — would delete ${totalDeleted} household staple clones`
      : `Deleted ${totalDeleted} household staple clones`
  );
  for (const row of perHousehold) {
    console.log(
      `  household "${row.name}" (${row.id}): ${row.deleted}` +
        (row.titles.length ? ` — ${row.titles.join("; ")}` : "")
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
