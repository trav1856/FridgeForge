"use client";

import { FavoriteButton } from "./FavoriteButton";
import { ShareRecipe } from "./ShareRecipe";
import { AddToShoppingList } from "./AddToShoppingList";

type Props = {
  recipeId: string;
  title: string;
  favorited?: boolean;
  missingNames?: string[];
};

export function RecipeDetailActions({
  recipeId,
  title,
  favorited,
  missingNames = [],
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FavoriteButton recipeId={recipeId} initialFavorited={favorited} />
      <ShareRecipe recipeId={recipeId} title={title} />
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
