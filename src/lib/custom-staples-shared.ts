import type { CatalogItem } from "./pantry-catalog";
import type { MeasureKind } from "./units";

export type CustomStapleDTO = {
  id: string;
  name: string;
  category: string;
  measureKind: string | null;
  suggestedUnit: string | null;
  hidden: boolean;
  householdId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Marks UI chips that came from user customs (vs static catalog). */
  custom: true;
};

/** Merge static catalog items with custom staples for a category. */
export function mergeCatalogWithCustoms(
  staticItems: CatalogItem[],
  customs: CustomStapleDTO[]
): (CatalogItem & { customId?: string; isCustom?: boolean })[] {
  const seen = new Set(staticItems.map((i) => i.name.toLowerCase()));
  const merged: (CatalogItem & { customId?: string; isCustom?: boolean })[] = [
    ...staticItems,
  ];
  for (const c of customs) {
    if (c.hidden) continue;
    const key = c.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      name: c.name,
      category: c.category as CatalogItem["category"],
      suggestedUnit: c.suggestedUnit ?? undefined,
      measureKind: (c.measureKind as MeasureKind | null) ?? undefined,
      customId: c.id,
      isCustom: true,
    });
  }
  return merged;
}
