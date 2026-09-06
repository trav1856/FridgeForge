import { recipeIconsFrom } from "@/lib/recipe-icons";

type Props = {
  title?: string | null;
  tags?: string[] | null;
  ingredients?: { name: string }[] | string[] | null;
  description?: string | null;
  flavorBoosters?: string[] | null;
  className?: string;
};

export function RecipeIcons(props: Props) {
  const icons = recipeIconsFrom(props);
  if (icons.length === 0) return null;
  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${props.className ?? ""}`}
      aria-label="Recipe highlights"
    >
      {icons.map((icon) => (
        <span
          key={icon.id}
          title={icon.label}
          aria-label={icon.label}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cream-100 text-base leading-none"
          role="img"
        >
          {icon.emoji}
        </span>
      ))}
    </div>
  );
}
