import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/mappers";
import {
  canEditRecipeImage,
  deleteManagedRecipeUserImage,
  saveRecipeUserImageFile,
  validateRecipeUserImageUpload,
} from "@/lib/recipe-user-images";

export { canEditRecipeImage };

export class RecipeImageUploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RecipeImageUploadError";
    this.status = status;
  }
}

type RecipeRow = {
  id: string;
  ownerUserId: string | null;
  householdId: string | null;
  imageUrl: string | null;
};

export async function loadRecipeForImageEdit(
  recipeId: string
): Promise<RecipeRow> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      id: true,
      ownerUserId: true,
      householdId: true,
      imageUrl: true,
    },
  });
  if (!recipe) throw new RecipeImageUploadError("Not found", 404);
  return recipe;
}

export function assertCanEditRecipeImage(
  recipe: RecipeRow,
  actor: { userId: string | null; householdId: string | null }
): void {
  if (!canEditRecipeImage(recipe, actor)) {
    throw new RecipeImageUploadError("Forbidden", 403);
  }
}

export async function setRecipeImageFromUpload(
  recipeId: string,
  file: { mime: string | null; size: number; bytes: Buffer },
  actor: { userId: string | null; householdId: string | null }
) {
  const existing = await loadRecipeForImageEdit(recipeId);
  assertCanEditRecipeImage(existing, actor);

  const check = validateRecipeUserImageUpload({
    mime: file.mime,
    size: file.size,
  });
  if (!check.ok) throw new RecipeImageUploadError(check.error, 400);

  const imageUrl = await saveRecipeUserImageFile(file.bytes, check.ext);
  const updated = await prisma.recipe.update({
    where: { id: recipeId },
    data: { imageUrl },
    include: { ingredients: true },
  });
  await deleteManagedRecipeUserImage(existing.imageUrl);
  return serializeRecipe(updated);
}

export async function clearRecipeImage(
  recipeId: string,
  actor: { userId: string | null; householdId: string | null }
) {
  const existing = await loadRecipeForImageEdit(recipeId);
  assertCanEditRecipeImage(existing, actor);

  const updated = await prisma.recipe.update({
    where: { id: recipeId },
    data: { imageUrl: null },
    include: { ingredients: true },
  });
  await deleteManagedRecipeUserImage(existing.imageUrl);
  return serializeRecipe(updated);
}
