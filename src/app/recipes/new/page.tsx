import { RecipeForm } from "@/components/RecipeForm";

export default function NewRecipePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-sage-900">
          Add recipe
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          Import from a URL or enter everything by hand.
        </p>
      </div>
      <RecipeForm />
    </div>
  );
}
