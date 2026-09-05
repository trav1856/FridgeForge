import { RecipeList } from "@/components/RecipeList";
import { StruggleBanner } from "@/components/StruggleBanner";

export default function RecipesPage() {
  return (
    <div>
      <StruggleBanner />
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-sage-900">Recipes</h1>
        <p className="mt-1 text-sm text-sage-600">
          Manual recipes plus URL import. Struggle Meal mode sorts budget heroes first.
        </p>
      </div>
      <RecipeList />
    </div>
  );
}
