"use client";

import { FavoriteButton } from "./FavoriteButton";
import { ShareRecipe } from "./ShareRecipe";
import { RequestRecipe } from "./RequestRecipe";
import { AddToShoppingList } from "./AddToShoppingList";

type Props = {
  recipeId: string;
  title: string;
  favorited?: boolean;
  missingNames?: string[];
  showRequest?: boolean;
};

export function RecipeDetailActions({
  recipeId,
  title,
  favorited,
  missingNames = [],
  showRequest = false,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FavoriteButton recipeId={recipeId} initialFavorited={favorited} />
      <ShareRecipe recipeId={recipeId} title={title} compact />
      {showRequest && <RequestRecipe recipeId={recipeId} />}
      {missingNames.length > 0 && (
        <AddToShoppingList
          items={missingNames.map((name) => ({ name }))}
          recipeId={recipeId}
          recipeTitle={title}
          label="Send missing to shopping list"
        />
      )}
    </div>
  );
}
