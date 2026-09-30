import { prisma } from "@/lib/db";
import {
  deleteManagedRecipeUserImage,
  managedImageUrlsForRecipe,
  unreferencedManagedImageUrls,
  type RecipeImageRefs,
} from "@/lib/recipe-user-images";

/**
 * After a recipe row is deleted, unlink its uploaded files under
 * public/recipe-images/user/ (main photo + story photos) — but only files that no
 * remaining recipe still references via imageUrl or originStoryMedia.
 * Best-effort: never throws (the recipe is already gone); returns the unlinked URLs.
 */
export async function deleteOrphanedRecipeImages(
  deleted: RecipeImageRefs & { id: string }
): Promise<string[]> {
  try {
    const candidates = managedImageUrlsForRecipe(deleted);
    if (!candidates.length) return [];
    // Anything that could reference one of the files: imageUrl or story media JSON
    // mentioning the managed folder at all (matched precisely afterwards).
    const others = await prisma.recipe.findMany({
      where: {
        id: { not: deleted.id },
        OR: [
          { imageUrl: { contains: "recipe-images" } },
          { originStoryMedia: { contains: "recipe-images" } },
        ],
      },
      select: { imageUrl: true, originStoryMedia: true },
    });
    const orphaned = unreferencedManagedImageUrls(candidates, others);
    for (const url of orphaned) {
      await deleteManagedRecipeUserImage(url);
    }
    return orphaned;
  } catch (err) {
    console.error("deleteOrphanedRecipeImages", deleted.id, err);
    return [];
  }
}
