import { AdminRecipesPanel, type AdminRecipeRow } from "@/components/AdminRecipesPanel";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/mappers";

export default async function AdminRecipesPage() {
  const recipes = await prisma.recipe.findMany({
    include: {
      ingredients: true,
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { reviews: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  // Only ship what the list needs (no steps / story media / nutrition blobs).
  const rows: AdminRecipeRow[] = recipes.map(({ owner, _count, ...raw }) => {
    const r = serializeRecipe(raw);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      visibility: r.visibility,
      costTier: r.costTier,
      isStruggleMeal: r.isStruggleMeal,
      kosherEligible: r.kosherEligible,
      halalEligible: r.halalEligible,
      vegetarianEligible: r.vegetarianEligible,
      pescatarianEligible: r.pescatarianEligible,
      veganEligible: r.veganEligible,
      carnivoreEligible: r.carnivoreEligible,
      atkinsEligible: r.atkinsEligible,
      lowCarbEligible: r.lowCarbEligible,
      lowSugarEligible: r.lowSugarEligible,
      lowSodiumEligible: r.lowSodiumEligible,
      kosherAdaptNote: r.kosherAdaptNote,
      veganAdaptNote: r.veganAdaptNote,
      vegetarianAdaptNote: r.vegetarianAdaptNote,
      reviewCount: _count.reviews,
      householdId: r.householdId,
      cuisine: r.cuisine,
      course: r.course,
      foodCategories: r.foodCategories,
      origins: r.origins,
      originStory: r.originStory,
      tags: r.tags,
      imageUrl: r.imageUrl,
      ingredients: r.ingredients.map((i) => ({ name: i.name })),
      owner: owner ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  return <AdminRecipesPanel initial={rows} />;
}
