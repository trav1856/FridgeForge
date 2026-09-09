"use client";

import { FavoriteButton } from "./FavoriteButton";
import { ShareRecipe } from "./ShareRecipe";
import { RequestRecipe } from "./RequestRecipe";
import { AddToShoppingList } from "./AddToShoppingList";
import { CookRecipeToggle } from "./CookRecipeToggle";

type Props = {
  recipeId: string;
  title: string;
  favorited?: boolean;
  /** All recipe ingredient names — shopping list always offered. */
  ingredientNames?: string[];
  showRequest?: boolean;
};

export function RecipeDetailActions({
  recipeId,
  title,
  favorited,
  ingredientNames = [],
  showRequest = false,
}: Props) {
  const shopping =
    ingredientNames.length > 0 ? (
      <AddToShoppingList
        items={ingredientNames.map((name) => ({ name }))}
        recipeId={recipeId}
        recipeTitle={title}
        label="Send to shopping list"
      />
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <FavoriteButton recipeId={recipeId} initialFavorited={favorited} />
        <ShareRecipe recipeId={recipeId} title={title} compact />
        {showRequest && <RequestRecipe recipeId={recipeId} />}
      </div>
      <CookRecipeToggle recipeId={recipeId} shoppingSlot={shopping} />
    </div>
  );
}
