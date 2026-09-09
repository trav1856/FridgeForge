import Link from "next/link";
import { RecipeImage } from "./RecipeImage";

export type VariantCard = {
  id: string;
  title: string;
  imageUrl: string | null;
};

type Props = {
  variants: VariantCard[];
};

/** Side strip of dish variants — hidden when empty. */
export function RecipeVariants({ variants }: Props) {
  if (!variants.length) return null;

  return (
    <aside className="w-full" data-testid="recipe-variants">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sage-500">
        Variations
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:max-h-80">
        {variants.map((v) => (
          <Link
            key={v.id}
            href={`/recipes/${v.id}`}
            className="card flex min-w-[9.5rem] max-w-[11rem] shrink-0 flex-col overflow-hidden p-0 transition hover:ring-2 hover:ring-ember-200 md:max-w-none md:min-w-0 md:flex-row md:items-center"
          >
            <div className="md:w-16 md:shrink-0">
              <RecipeImage
                src={v.imageUrl}
                alt={v.title}
                variant="card"
                className="!h-24 rounded-none md:!h-16 md:rounded-l-xl md:rounded-r-none"
              />
            </div>
            <p className="px-2.5 py-2 text-xs font-semibold leading-snug text-sage-900 md:px-3">
              {v.title}
            </p>
          </Link>
        ))}
      </div>
    </aside>
  );
}
