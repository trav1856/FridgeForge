import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db";
import { parseStringArray } from "@/lib/json";
import {
  isTrendingEligible,
  pickTrendingRecipes,
} from "@/lib/trending-recipes";
import { RecipeImage } from "@/components/RecipeImage";
import { RecipeIcons } from "@/components/RecipeIcons";

const LIMIT = 6;

type CardRecipe = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  costTier: string;
  isStruggleMeal: boolean;
  imageUrl: string | null;
  servings: number;
  ingredients: { name: string }[];
  householdId: string | null;
  visibility: string;
};

function toCard(r: {
  id: string;
  title: string;
  description: string | null;
  tags: string;
  costTier: string;
  isStruggleMeal: boolean;
  imageUrl: string | null;
  servings: number;
  householdId: string | null;
  visibility: string;
  ingredients: { name: string }[];
}): CardRecipe {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    tags: parseStringArray(r.tags),
    costTier: r.costTier,
    isStruggleMeal: r.isStruggleMeal,
    imageUrl: r.imageUrl,
    servings: r.servings,
    ingredients: r.ingredients,
    householdId: r.householdId,
    visibility: r.visibility,
  };
}

/**
 * Homepage trending strip — below Breakfast/Lunch/Dinner.
 * Uses favorite counts when present; otherwise a shuffled shared sample
 * labeled Popular this week (no fake counts).
 */
export async function PopularThisWeek() {
  noStore();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [weekGroups, allTimeGroups, sharedRows] = await Promise.all([
    prisma.recipeFavorite.groupBy({
      by: ["recipeId"],
      where: { createdAt: { gte: weekAgo } },
      _count: { recipeId: true },
      orderBy: { _count: { recipeId: "desc" } },
      take: 24,
    }),
    prisma.recipeFavorite.groupBy({
      by: ["recipeId"],
      _count: { recipeId: true },
      orderBy: { _count: { recipeId: "desc" } },
      take: 24,
    }),
    prisma.recipe.findMany({
      where: { householdId: null },
      include: { ingredients: { select: { name: true } } },
      orderBy: { title: "asc" },
      take: 40,
    }),
  ]);

  const idSet = new Set([
    ...weekGroups.map((g) => g.recipeId),
    ...allTimeGroups.map((g) => g.recipeId),
  ]);
  const favoritedRows =
    idSet.size === 0
      ? []
      : await prisma.recipe.findMany({
          where: { id: { in: [...idSet] } },
          include: { ingredients: { select: { name: true } } },
        });
  const byId = new Map(favoritedRows.map((r) => [r.id, r]));

  const weekRanked = weekGroups
    .map((g) => {
      const row = byId.get(g.recipeId);
      if (!row || !isTrendingEligible(row)) return null;
      return {
        recipe: toCard(row),
        favoriteCount: g._count.recipeId,
      };
    })
    .filter(Boolean) as { recipe: CardRecipe; favoriteCount: number }[];

  const allTimeRanked = allTimeGroups
    .map((g) => {
      const row = byId.get(g.recipeId);
      if (!row || !isTrendingEligible(row)) return null;
      return {
        recipe: toCard(row),
        favoriteCount: g._count.recipeId,
      };
    })
    .filter(Boolean) as { recipe: CardRecipe; favoriteCount: number }[];

  const fallback = sharedRows.map(toCard);
  const picks = pickTrendingRecipes(
    weekRanked,
    allTimeRanked,
    fallback,
    LIMIT
  );
  if (picks.length === 0) return null;

  const usingFallback = picks[0]?.source === "fallback";
  const subtitle = usingFallback
    ? "A taste of the shared catalog — favorite recipes to help this list climb."
    : picks[0]?.source === "week"
      ? "Based on favorites from the last 7 days."
      : "Based on all-time favorites.";

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">
          Community
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-sage-900 sm:text-3xl">
          Popular this week
        </h2>
        <p className="mt-1 text-sm text-sage-600">{subtitle}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map(({ recipe: r, favoriteCount, source }) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="card group relative flex h-full flex-col overflow-hidden transition hover:shadow-card-hover"
            >
              <RecipeImage src={r.imageUrl} alt={r.title} />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`badge ${
                      r.costTier === "cheap"
                        ? "bg-sage-100 text-sage-800"
                        : "bg-ember-50 text-ember-800"
                    }`}
                  >
                    {r.costTier}
                  </span>
                  {favoriteCount != null && source !== "fallback" && (
                    <span className="badge bg-cream-200 text-sage-700">
                      {favoriteCount}{" "}
                      {favoriteCount === 1 ? "favorite" : "favorites"}
                    </span>
                  )}
                </div>
                <RecipeIcons
                  title={r.title}
                  tags={r.tags}
                  ingredients={r.ingredients}
                  description={r.description}
                  className="mb-2 mt-2"
                />
                <h3 className="font-display text-lg font-bold text-sage-900 group-hover:text-ember-700">
                  {r.title}
                </h3>
                {r.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-sage-600">
                    {r.description}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
