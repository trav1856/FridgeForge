import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/mappers";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { canRequestRecipe, recipeIsReadable } from "@/lib/recipe-request";
import { estimateRecipeNutrition } from "@/lib/recipe-nutrition";
import { RecipeDeals } from "@/components/RecipeDeals";
import { RecipeImage } from "@/components/RecipeImage";
import { RecipeIngredients } from "@/components/RecipeIngredients";
import { RecipeIcons } from "@/components/RecipeIcons";
import { RecipeDetailActions } from "@/components/RecipeDetailActions";
import { RecipeNutritionCard } from "@/components/RecipeNutritionCard";
import { RecipeReviews } from "@/components/RecipeReviews";
import { RecipeOriginStory } from "@/components/RecipeOriginStory";
import { RecipeVariants } from "@/components/RecipeVariants";
import { dishKeyForTitle } from "@/lib/dish-key";
import { recipeListAccessWhere } from "@/lib/recipe-visibility";

type Props = { params: Promise<{ id: string }> };

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const householdId = await resolveHouseholdId();
  const raw = await prisma.recipe.findUnique({
    where: { id },
    include: {
      ingredients: true,
      ...(user
        ? {
            favorites: {
              where: { userId: user.id },
              select: { id: true },
            },
          }
        : {}),
      shares: {
        select: {
          toUserId: true,
          toUserEmail: true,
          toHouseholdId: true,
        },
      },
    },
  });
  if (
    !raw ||
    !recipeIsReadable(raw, householdId, {
      userId: user?.id,
      userEmail: user?.email,
    })
  )
    notFound();
  const showRequest = canRequestRecipe(
    {
      id: raw.id,
      householdId: raw.householdId,
      ownerUserId: raw.ownerUserId,
      visibility: raw.visibility,
    },
    user ? { userId: user.id, householdId } : null
  );
  const favorited =
    user && Array.isArray((raw as { favorites?: unknown[] }).favorites)
      ? ((raw as { favorites: unknown[] }).favorites.length > 0)
      : false;
  const { favorites: _f, shares: _shares, ...rest } = raw as typeof raw & {
    favorites?: unknown;
    shares?: unknown;
  };
  const recipe = serializeRecipe(rest);

  const nutritionEstimate = estimateRecipeNutrition(
    recipe.ingredients,
    recipe.servings
  );

  const hasPlaybook =
    recipe.techniqueTips.length > 0 || recipe.flavorBoosters.length > 0;

  const dishKey =
    (raw as { dishKey?: string | null }).dishKey ||
    dishKeyForTitle(recipe.title);

  let variants: { id: string; title: string; imageUrl: string | null }[] = [];
  if (dishKey) {
    const access = recipeListAccessWhere({
      userId: user?.id,
      userEmail: user?.email,
      householdId,
    });
    const rows = await prisma.recipe.findMany({
      where: {
        AND: [
          access,
          { id: { not: recipe.id } },
          {
            OR: [
              { dishKey },
              // Fallback: same cuisine+course with title containing significant token
              ...(recipe.cuisine && recipe.course
                ? [
                    {
                      cuisine: recipe.cuisine,
                      course: recipe.course,
                      title: {
                        contains: dishKey.split("-").slice(0, 2).join(" "),
                        mode: "insensitive" as const,
                      },
                    },
                  ]
                : []),
            ],
          },
        ],
      },
      select: { id: true, title: true, imageUrl: true, dishKey: true },
      take: 24,
      orderBy: { title: "asc" },
    });
    // Prefer exact dishKey matches; de-dupe; cap ~12
    const exact = rows.filter((r) => r.dishKey === dishKey);
    const rest = rows.filter((r) => r.dishKey !== dishKey);
    const seen = new Set<string>();
    variants = [];
    for (const r of [...exact, ...rest]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      variants.push({ id: r.id, title: r.title, imageUrl: r.imageUrl });
      if (variants.length >= 12) break;
    }
  }

  return (
    <article className="space-y-6">
      <div>
        <Link href="/recipes" className="text-sm font-medium text-ember-700 hover:underline">
          ← Recipes
        </Link>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`badge ${recipe.costTier === "cheap" ? "bg-sage-100 text-sage-800" : "bg-ember-50 text-ember-800"}`}>
            {recipe.costTier}
          </span>
          {recipe.isStruggleMeal && (
            <span className="badge bg-ember-600 text-white">struggle meal</span>
          )}
          {recipe.cuisine && (
            <span className="badge bg-sage-200 text-sage-900">{recipe.cuisine}</span>
          )}
          {recipe.course && (
            <span className="badge bg-cream-300 text-sage-800">{recipe.course}</span>
          )}
          {(recipe.foodCategories || []).slice(0, 4).map((c: string) => (
            <span key={`fc-${c}`} className="badge bg-cream-200 text-sage-700">
              {c}
            </span>
          ))}
          {(recipe.origins || []).slice(0, 4).map((o: string) => (
            <span key={`or-${o}`} className="badge bg-ember-50 text-ember-800">
              {o}
            </span>
          ))}
          {recipe.visibility && (
            <span className="badge bg-cream-200 text-sage-700">
              {recipe.visibility === "public"
                ? "global"
                : recipe.visibility === "private"
                  ? "household"
                  : recipe.visibility}
            </span>
          )}
          {recipe.tags.map((t) => (
            <span key={t} className="badge bg-cream-200 text-sage-700">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-3 flex max-w-4xl flex-col gap-4 md:flex-row md:items-start">
          <div className="min-w-0 flex-1 max-w-2xl">
            <RecipeImage src={recipe.imageUrl} alt={recipe.title} variant="hero" />
          </div>
          <div className="md:w-44 md:shrink-0 lg:w-52">
            <RecipeVariants variants={variants} />
          </div>
        </div>
        <RecipeIcons
          title={recipe.title}
          tags={recipe.tags}
          ingredients={recipe.ingredients}
          description={recipe.description}
          flavorBoosters={recipe.flavorBoosters}
          className="mt-3"
        />
        <h1 className="mt-3 font-display text-3xl font-bold text-sage-900 sm:text-4xl">
          {recipe.title}
        </h1>
        {recipe.description && (
          <p className="mt-2 max-w-2xl text-sage-700">{recipe.description}</p>
        )}
        <p className="mt-2 text-sm text-sage-500">
          {recipe.servings} servings
          {recipe.cookTimeMinutes != null ? ` · ${recipe.cookTimeMinutes} min` : ""}
          {recipe.sourceUrl && (
            <>
              {" · "}
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ember-700 hover:underline"
              >
                Source
              </a>
            </>
          )}
        </p>
        <div className="mt-4">
          <RecipeDetailActions
            recipeId={recipe.id}
            title={recipe.title}
            favorited={favorited}
            showRequest={showRequest}
          />
        </div>
      </div>

      <RecipeDeals recipeId={recipe.id} recipeTitle={recipe.title} />

      <div className="grid gap-4 md:grid-cols-2">
        <RecipeIngredients ingredients={recipe.ingredients} />

        <section className="card p-5">
          <h2 className="font-display text-lg font-bold text-sage-900">Steps</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-sage-800">
            {recipe.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </section>
      </div>

      {(nutritionEstimate.totalCount > 0 || hasPlaybook) && (
        <div
          className={
            hasPlaybook && nutritionEstimate.totalCount > 0
              ? "grid gap-4 md:grid-cols-2"
              : "grid gap-4"
          }
        >
          {nutritionEstimate.totalCount > 0 && (
            <RecipeNutritionCard estimate={nutritionEstimate} />
          )}

          {hasPlaybook && (
            <section className="card border-ember-100 bg-gradient-to-br from-ember-50/80 to-cream-50 p-5">
              <h2 className="font-display text-lg font-bold text-ember-900">
                Proud-plate playbook
              </h2>
              {recipe.flavorBoosters.length > 0 && (
                <p className="mt-2 text-sm text-sage-800">
                  <span className="font-semibold">Flavor boosters:</span>{" "}
                  {recipe.flavorBoosters.join(" · ")}
                </p>
              )}
              {recipe.techniqueTips.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-sage-800">
                  {recipe.techniqueTips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <RecipeOriginStory title={recipe.title} originStory={recipe.originStory} />
      <RecipeReviews recipeId={recipe.id} recipeTitle={recipe.title} />

    </article>
  );
}
