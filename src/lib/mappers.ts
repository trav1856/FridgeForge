import type { PantryItem, Recipe, RecipeIngredient } from "@prisma/client";
import { parseStringArray } from "./json";
import type { CostTier, PantrySnapshot, RecipeForMatch } from "./types";

export function toPantrySnapshot(item: PantryItem): PantrySnapshot {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    tags: parseStringArray(item.tags),
    barcode: item.barcode,
  };
}

export function toRecipeForMatch(
  recipe: Recipe & { ingredients: RecipeIngredient[] }
): RecipeForMatch {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    steps: parseStringArray(recipe.steps),
    costTier: (recipe.costTier as CostTier) || "cheap",
    tags: parseStringArray(recipe.tags),
    servings: recipe.servings,
    isStruggleMeal: recipe.isStruggleMeal,
    techniqueTips: parseStringArray(recipe.techniqueTips),
    flavorBoosters: parseStringArray(recipe.flavorBoosters),
    ingredients: recipe.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      optional: i.optional,
    })),
  };
}

export function serializePantry(item: PantryItem) {
  return {
    ...item,
    tags: parseStringArray(item.tags),
    expirationDate: item.expirationDate?.toISOString() ?? null,
  };
}

export function serializeRecipe(
  recipe: Recipe & { ingredients: RecipeIngredient[] }
) {
  return {
    ...recipe,
    steps: parseStringArray(recipe.steps),
    tags: parseStringArray(recipe.tags),
    techniqueTips: parseStringArray(recipe.techniqueTips),
    flavorBoosters: parseStringArray(recipe.flavorBoosters),
    ingredients: recipe.ingredients,
  };
}
