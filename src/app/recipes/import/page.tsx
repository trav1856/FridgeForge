import { RecipePageImport } from "@/components/RecipePageImport";

export default function RecipeImportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-sage-900">
          Import from photo
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          Scan a cookbook or sheet page, box one recipe, review the draft, then
          save. Repeat for other recipes on the same page.
        </p>
      </div>
      <RecipePageImport />
    </div>
  );
}
