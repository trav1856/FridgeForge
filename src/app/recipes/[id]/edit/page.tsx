import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RecipeForm } from "@/components/RecipeForm";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { serializeRecipe } from "@/lib/mappers";
import { prisma } from "@/lib/db";
import { recipeIsReadable } from "@/lib/recipe-request";
import { canEditRecipe } from "@/lib/recipe-user-images";

type Props = { params: Promise<{ id: string }> };

export default async function EditRecipePage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  const householdId = await resolveHouseholdId();
  const raw = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: true },
  });
  if (
    !raw ||
    !recipeIsReadable(raw, householdId, {
      userId: user.id,
      userEmail: user.email,
    })
  ) {
    notFound();
  }
  if (
    !canEditRecipe(
      { ownerUserId: raw.ownerUserId, householdId: raw.householdId },
      { userId: user.id, householdId }
    )
  ) {
    redirect(`/recipes/${id}`);
  }

  const recipe = serializeRecipe(raw);
  const visibility =
    recipe.visibility === "public"
      ? "global"
      : recipe.visibility === "private"
        ? "household"
        : (recipe.visibility as "global" | "household" | "shared");

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/recipes/${id}`}
          className="text-sm font-medium text-ember-700 hover:underline"
        >
          ← Back to recipe
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-sage-900">
          Edit recipe
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          Update your recipe details, ingredients, and steps.
        </p>
      </div>
      <RecipeForm
        mode="edit"
        recipeId={recipe.id}
        hideUrlImport
        initialDraft={{
          title: recipe.title,
          description: recipe.description,
          imageUrl: recipe.imageUrl,
          cookTimeMinutes: recipe.cookTimeMinutes,
          ingredients: recipe.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            optional: i.optional,
          })),
          steps: recipe.steps,
          costTier: recipe.costTier === "moderate" ? "moderate" : "cheap",
          tags: recipe.tags,
          cuisine: recipe.cuisine,
          course: recipe.course,
          foodCategories: recipe.foodCategories,
          origins: recipe.origins,
          originStory: recipe.originStory,
          servings: recipe.servings,
          isStruggleMeal: recipe.isStruggleMeal,
          kosherEligible: recipe.kosherEligible,
          halalEligible: recipe.halalEligible,
          vegetarianEligible: recipe.vegetarianEligible,
          pescatarianEligible: recipe.pescatarianEligible,
          veganEligible: recipe.veganEligible,
          carnivoreEligible: recipe.carnivoreEligible,
          atkinsEligible: recipe.atkinsEligible,
          lowCarbEligible: recipe.lowCarbEligible,
          lowSugarEligible: recipe.lowSugarEligible,
          lowSodiumEligible: recipe.lowSodiumEligible,
          kosherAdaptNote: recipe.kosherAdaptNote,
          halalAdaptNote: recipe.halalAdaptNote,
          veganAdaptNote: recipe.veganAdaptNote,
          vegetarianAdaptNote: recipe.vegetarianAdaptNote,
          allergenTags: recipe.allergenTags,
          techniqueTips: recipe.techniqueTips,
          flavorBoosters: recipe.flavorBoosters,
          visibility,
          sourceUrl: recipe.sourceUrl,
        }}
      />
    </div>
  );
}
