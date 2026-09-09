import Link from "next/link";
import { prisma } from "@/lib/db";
import { parseStringArray } from "@/lib/json";
import {
  MEAL_SLOT_LABEL,
  pickRecipeOfTheWeek,
  type MealSlot,
} from "@/lib/recipe-of-the-week";
import { RecipeImage } from "@/components/RecipeImage";
import { RecipeIcons } from "@/components/RecipeIcons";

const SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: "🌅",
  lunch: "🥗",
  dinner: "🍽️",
};

/**
 * Homepage "Recipe of the week" — three shared-catalog cards (Breakfast /
 * Lunch / Dinner), stable for the ISO calendar week.
 */
export async function RecipeOfTheWeek() {
  // Shared / system catalog only (householdId null)
  const rows = await prisma.recipe.findMany({
    where: { householdId: null },
    include: { ingredients: { select: { name: true } } },
    orderBy: { title: "asc" },
  });

  const catalog = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    tags: parseStringArray(r.tags),
    costTier: r.costTier,
    isStruggleMeal: r.isStruggleMeal,
    imageUrl: r.imageUrl,
    servings: r.servings,
    ingredients: r.ingredients,
  }));

  const picks = pickRecipeOfTheWeek(catalog);
  if (picks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">
          This week
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-sage-900 sm:text-3xl">
          Recipe of the week
        </h2>
        <p className="mt-1 text-sm text-sage-600">
          Featured picks from the shared catalog — Breakfast, Lunch, and Dinner.
          Stable all week; new lineup next Monday.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {picks.map(({ slot, recipe: r }) => (
          <li key={slot}>
            <Link
              href={`/recipes/${r.id}`}
              className="card group relative flex h-full flex-col overflow-hidden transition hover:shadow-card-hover"
            >
              <RecipeImage src={r.imageUrl} alt={r.title} />
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ember-700">
                  {SLOT_EMOJI[slot]} {MEAL_SLOT_LABEL[slot]}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={`badge ${
                      r.costTier === "cheap"
                        ? "bg-sage-100 text-sage-800"
                        : "bg-ember-50 text-ember-800"
                    }`}
                  >
                    {r.costTier}
                  </span>
                  {r.isStruggleMeal && (
                    <span className="badge bg-ember-600 text-white">
                      struggle meal
                    </span>
                  )}
                  {r.tags
                    .filter((t) => t !== "struggle")
                    .slice(0, 2)
                    .map((t) => (
                      <span
                        key={t}
                        className="badge bg-cream-200 text-sage-700"
                      >
                        {t}
                      </span>
                    ))}
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
                <p className="mt-auto pt-2 text-xs text-sage-500">
                  {r.ingredients.length} ingredients · {r.servings} servings
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
