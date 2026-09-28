import { prisma } from "@/lib/db";
import {
  STORY_MEDIA_MAX_ITEMS,
  addYoutubeToStoryMedia,
  newStoryMediaItemId,
  parseStoryMedia,
  removeStoryMediaItem,
  stringifyStoryMedia,
  type StoryMediaItem,
} from "@/lib/origin-story-media";
import {
  canEditRecipe,
  deleteManagedRecipeUserImage,
  saveRecipeUserImageFile,
  validateRecipeUserImageUpload,
} from "@/lib/recipe-user-images";

export class StoryMediaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "StoryMediaError";
    this.status = status;
  }
}

type Actor = { userId: string | null; householdId: string | null };

async function loadForEdit(recipeId: string, actor: Actor) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      id: true,
      ownerUserId: true,
      householdId: true,
      originStoryMedia: true,
    },
  });
  if (!recipe) throw new StoryMediaError("Not found", 404);
  // Same permission as full recipe edit (owner only).
  if (!canEditRecipe(recipe, actor)) {
    throw new StoryMediaError("Forbidden", 403);
  }
  return { recipe, items: parseStoryMedia(recipe.originStoryMedia) };
}

async function saveItems(recipeId: string, items: StoryMediaItem[]) {
  const updated = await prisma.recipe.update({
    where: { id: recipeId },
    data: { originStoryMedia: stringifyStoryMedia(items) },
    select: { originStoryMedia: true },
  });
  return parseStoryMedia(updated.originStoryMedia);
}

export async function addStoryImage(
  recipeId: string,
  file: { mime: string | null; size: number; bytes: Buffer },
  actor: Actor
): Promise<{ items: StoryMediaItem[]; item: StoryMediaItem }> {
  const { items } = await loadForEdit(recipeId, actor);
  if (items.length >= STORY_MEDIA_MAX_ITEMS) {
    throw new StoryMediaError(
      `Up to ${STORY_MEDIA_MAX_ITEMS} photos/videos per story.`
    );
  }
  const check = validateRecipeUserImageUpload({
    mime: file.mime,
    size: file.size,
  });
  if (!check.ok) throw new StoryMediaError(check.error, 400);
  const url = await saveRecipeUserImageFile(file.bytes, check.ext);
  const item: StoryMediaItem = { id: newStoryMediaItemId(), kind: "image", url };
  try {
    const next = await saveItems(recipeId, [...items, item]);
    return { items: next, item };
  } catch (err) {
    await deleteManagedRecipeUserImage(url);
    throw err;
  }
}

export async function addStoryYoutube(
  recipeId: string,
  url: string,
  actor: Actor
): Promise<{ items: StoryMediaItem[]; item: StoryMediaItem }> {
  const { items } = await loadForEdit(recipeId, actor);
  const res = addYoutubeToStoryMedia(items, url);
  if (!res.ok) throw new StoryMediaError(res.error, 400);
  const next = await saveItems(recipeId, res.items);
  return { items: next, item: res.item };
}

export async function removeStoryMedia(
  recipeId: string,
  itemId: string,
  actor: Actor
): Promise<{ items: StoryMediaItem[] }> {
  const { items } = await loadForEdit(recipeId, actor);
  const { items: rest, removed } = removeStoryMediaItem(items, itemId);
  if (!removed) throw new StoryMediaError("Media item not found", 404);
  const next = await saveItems(recipeId, rest);
  if (removed.kind === "image") {
    await deleteManagedRecipeUserImage(removed.url);
  }
  return { items: next };
}
