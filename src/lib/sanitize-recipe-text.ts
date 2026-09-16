import {
  decodeHtmlEntities,
  decodeHtmlEntitiesNullable,
  decodeRecipeTextFields,
} from "@/lib/html-entities";

/** Decode HTML entities on recipe create/update payload fields. */
export function sanitizeRecipeWritePayload<T extends Record<string, unknown>>(
  data: T
): T {
  const next: Record<string, unknown> = { ...data };
  if (typeof next.title === "string") {
    next.title = decodeHtmlEntities(next.title);
  }
  if ("description" in next) {
    next.description = decodeHtmlEntitiesNullable(
      next.description as string | null | undefined
    );
  }
  if (Array.isArray(next.steps)) {
    next.steps = (next.steps as unknown[]).map((s) =>
      typeof s === "string" ? decodeHtmlEntities(s) : s
    );
  }
  if (Array.isArray(next.ingredients)) {
    next.ingredients = (next.ingredients as { name?: unknown }[]).map((ing) =>
      ing && typeof ing === "object"
        ? {
            ...ing,
            name:
              typeof ing.name === "string"
                ? decodeHtmlEntities(ing.name)
                : ing.name,
          }
        : ing
    );
  }
  if (Array.isArray(next.techniqueTips)) {
    next.techniqueTips = (next.techniqueTips as unknown[]).map((s) =>
      typeof s === "string" ? decodeHtmlEntities(s) : s
    );
  }
  if ("originStory" in next && typeof next.originStory === "string") {
    next.originStory = decodeHtmlEntities(next.originStory);
  }
  for (const key of [
    "kosherAdaptNote",
    "halalAdaptNote",
    "veganAdaptNote",
    "vegetarianAdaptNote",
  ] as const) {
    if (key in next) {
      next[key] = decodeHtmlEntitiesNullable(
        next[key] as string | null | undefined
      );
    }
  }
  return next as T;
}

export { decodeRecipeTextFields };
