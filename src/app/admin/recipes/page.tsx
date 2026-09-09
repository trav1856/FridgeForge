import { AdminRecipesPanel } from "@/components/AdminRecipesPanel";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/mappers";

export default async function AdminRecipesPage() {
  const recipes = await prisma.recipe.findMany({
    include: { ingredients: true, _count: { select: { reviews: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <AdminRecipesPanel
      initial={recipes.map((r) => ({
        ...serializeRecipe(r),
        reviewCount: r._count.reviews,
      }))}
    />
  );
}
