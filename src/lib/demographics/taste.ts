import { prisma } from "@/lib/db";

function utcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** One row per user/recipe/day; repeat opens the same day bump `views`. */
export async function recordRecipeView(userId: string, recipe: { id: string; cuisine: string | null }, now = new Date()) {
  const day = utcDay(now);
  await prisma.recipeView.upsert({
    where: { userId_recipeId_day: { userId, recipeId: recipe.id, day } },
    create: { userId, recipeId: recipe.id, cuisine: recipe.cuisine, day, lastAt: now },
    update: { views: { increment: 1 }, lastAt: now, cuisine: recipe.cuisine },
  });
}

export type TasteRow = { cuisine: string; views: number; recipes: number; favorites: number; score: number };

/** Pure: merge view + favorite counts; favorites weigh 3x a view. */
export function rankTaste(views: { cuisine: string | null; views: number; recipes: number }[], favs: { cuisine: string | null; favorites: number }[]): TasteRow[] {
  const m = new Map<string, TasteRow>();
  const row = (c: string) => m.get(c) ?? m.set(c, { cuisine: c, views: 0, recipes: 0, favorites: 0, score: 0 }).get(c)!;
  for (const v of views) if (v.cuisine) { const r = row(v.cuisine); r.views += v.views; r.recipes += v.recipes; }
  for (const f of favs) if (f.cuisine) row(f.cuisine).favorites += f.favorites;
  for (const r of m.values()) r.score = r.views + 3 * r.favorites;
  return [...m.values()].sort((a, b) => b.score - a.score || a.cuisine.localeCompare(b.cuisine));
}

export async function myTaste(userId: string): Promise<TasteRow[]> {
  const views = await prisma.$queryRawUnsafe<{ cuisine: string | null; views: bigint; recipes: bigint }[]>(
    `SELECT "cuisine", SUM("views")::bigint AS views, COUNT(DISTINCT "recipeId")::bigint AS recipes FROM "RecipeView" WHERE "userId" = $1 GROUP BY "cuisine"`,
    userId
  );
  const favs = await prisma.$queryRawUnsafe<{ cuisine: string | null; favorites: bigint }[]>(
    `SELECT r."cuisine", COUNT(*)::bigint AS favorites FROM "RecipeFavorite" f JOIN "Recipe" r ON r."id" = f."recipeId" WHERE f."userId" = $1 GROUP BY r."cuisine"`,
    userId
  );
  return rankTaste(
    views.map((v) => ({ cuisine: v.cuisine, views: Number(v.views), recipes: Number(v.recipes) })),
    favs.map((f) => ({ cuisine: f.cuisine, favorites: Number(f.favorites) }))
  );
}

export async function clearMyViews(userId: string) {
  return (await prisma.recipeView.deleteMany({ where: { userId } })).count;
}
