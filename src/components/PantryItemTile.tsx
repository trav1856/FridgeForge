"use client";

import { formatNutritionBlurb } from "@/lib/open-food-facts";
import { pantryIconFor } from "@/lib/pantry-icons";
import { resolvePantryImageUrl } from "@/lib/pantry-images";

export type PantryTileItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  tags: string[];
  barcode?: string | null;
  expirationDate: string | null;
  nutritionJson?: string | null;
  imageUrl?: string | null;
};

type Props = {
  item: PantryTileItem;
  onEdit: (item: PantryTileItem) => void;
  onRemove: (id: string) => void;
};

/**
 * 1:1 square photo tile for low-literacy pantry recognition.
 * Image fills the square; caption + qty controls sit below.
 */
export function PantryItemTile({ item, onEdit, onRemove }: Props) {
  const photo = resolvePantryImageUrl({
    name: item.name,
    imageUrl: item.imageUrl,
    category: item.category,
  });
  const fallback = pantryIconFor({
    name: item.name,
    category: item.category,
  });
  const nutrition = formatNutritionBlurb(item.nutritionJson);
  const low = item.quantity <= 0;

  return (
    <li
      className={`card flex flex-col overflow-hidden ${
        low ? "ring-1 ring-ember-300" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="group relative aspect-square w-full overflow-hidden bg-sage-100 outline-none ring-ember-500 focus-visible:ring-2"
        aria-label={`Edit ${item.name}, ${item.quantity} ${item.unit}`}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={item.name}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-5xl"
            title={fallback.label}
            aria-hidden
          >
            {fallback.emoji}
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-6">
          <span className="line-clamp-2 text-left text-xs font-semibold leading-snug text-white drop-shadow">
            {item.name}
          </span>
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <p className="text-sm font-semibold leading-tight text-sage-900 sm:hidden">
          {item.name}
        </p>
        <p className="text-sm text-sage-700">
          <span className="font-semibold tabular-nums text-sage-900">
            {item.quantity}
          </span>{" "}
          {item.unit}
        </p>
        {item.expirationDate && (
          <p className="text-xs text-ember-700">
            exp {item.expirationDate.slice(0, 10)}
          </p>
        )}
        {nutrition && (
          <p className="line-clamp-2 text-[10px] leading-snug text-sage-500">
            {nutrition}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="badge bg-sage-100 text-[10px] text-sage-700"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {low && (
          <p className="text-[11px] font-medium text-ember-800">
            Need more {item.name}
          </p>
        )}
        <div className="mt-auto flex gap-1 pt-1">
          <button
            type="button"
            className="btn-ghost flex-1 px-1 py-1 text-xs"
            onClick={() => onEdit(item)}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-ghost px-1 py-1 text-xs text-red-700"
            onClick={() => onRemove(item.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
