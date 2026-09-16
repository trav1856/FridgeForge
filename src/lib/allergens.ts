/**
 * Personal allergen flags + recipe allergen tags.
 * Recipe allergenTags are public factual labels; conflict warnings are private
 * to the signed-in user who flagged those allergens.
 */

export const COMMON_ALLERGENS = [
  { id: "milk", label: "Milk / dairy" },
  { id: "eggs", label: "Eggs" },
  { id: "fish", label: "Fish" },
  { id: "shellfish", label: "Shellfish" },
  { id: "tree_nuts", label: "Tree nuts" },
  { id: "peanuts", label: "Peanuts" },
  { id: "wheat", label: "Wheat / gluten" },
  { id: "soy", label: "Soy" },
  { id: "sesame", label: "Sesame" },
] as const;

export type CommonAllergenId = (typeof COMMON_ALLERGENS)[number]["id"];

const ALLERGEN_PATTERNS: Record<CommonAllergenId, RegExp> = {
  milk: /\b(milk|butter|cheese|cream|yogurt|yoghurt|whey|casein|ghee|dairy)\b/i,
  eggs: /\b(egg\b|eggs\b|mayonnaise|mayo\b)\b/i,
  fish: /\b(fish|salmon|tuna|cod|tilapia|trout|sardine|anchov|halibut|mahi|fish sauce)\b/i,
  shellfish:
    /\b(shellfish|shrimp|prawn|crab\b|lobster|clam\b|mussel|oyster|scallop|calamari|squid|octopus|crawfish|crayfish)\b/i,
  tree_nuts:
    /\b(almond|walnut|cashew|pecan|pistachio|hazelnut|macadamia|brazil nut|tree nut|pine nut)\b/i,
  peanuts: /\b(peanut|peanuts|groundnut)\b/i,
  wheat: /\b(wheat|flour|bread|pasta|noodle|gluten|soy sauce|tortilla|bagel|bun\b|cracker)\b/i,
  soy: /\b(soy\b|soya|tofu|edamame|miso|tempeh|soy sauce)\b/i,
  sesame: /\b(sesame|tahini)\b/i,
};

function blobFrom(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  ingredients?: { name: string }[] | string[] | null;
  steps?: string[] | string | null;
}): string {
  const parts: string[] = [];
  if (input.title) parts.push(input.title);
  if (input.description) parts.push(input.description);
  if (typeof input.tags === "string") parts.push(input.tags);
  else if (Array.isArray(input.tags)) parts.push(...input.tags);
  if (typeof input.steps === "string") parts.push(input.steps);
  else if (Array.isArray(input.steps)) parts.push(...input.steps);
  if (Array.isArray(input.ingredients)) {
    for (const ing of input.ingredients) {
      parts.push(typeof ing === "string" ? ing : ing.name);
    }
  }
  return parts.join(" \n ");
}

/** Normalize user/custom allergen tokens (trim, lower, collapse spaces → underscore for ids). */
export function normalizeAllergenToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseAllergenList(
  value: string[] | string | null | undefined
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((v) => normalizeAllergenToken(String(v)))
          .filter(Boolean)
      ),
    ];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseAllergenList(parsed);
    } catch {
      /* fall through */
    }
    return parseAllergenList(
      value
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  return [];
}

/** Infer common allergen tags from recipe text (conservative). */
export function inferAllergenTags(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
  ingredients?: { name: string }[] | string[] | null;
  steps?: string[] | string | null;
}): string[] {
  const blob = blobFrom(input);
  const found: string[] = [];
  for (const a of COMMON_ALLERGENS) {
    if (ALLERGEN_PATTERNS[a.id].test(blob)) found.push(a.id);
  }
  return found;
}

export function allergenLabel(id: string): string {
  const common = COMMON_ALLERGENS.find((a) => a.id === id);
  if (common) return common.label;
  return id.replace(/_/g, " ");
}

/**
 * Conflict set: intersection of user allergenFlags and recipe allergenTags
 * (or inferred tags when recipe tags empty).
 */
export function conflictingAllergens(
  recipe: {
    allergenTags?: string[] | string | null;
    title?: string | null;
    description?: string | null;
    tags?: string[] | string | null;
    ingredients?: { name: string }[] | string[] | null;
    steps?: string[] | string | null;
  },
  userFlags: string[] | string | null | undefined
): string[] {
  const flags = parseAllergenList(userFlags);
  if (!flags.length) return [];
  let recipeTags = parseAllergenList(recipe.allergenTags);
  if (!recipeTags.length) {
    recipeTags = inferAllergenTags(recipe);
  }
  const recipeSet = new Set(recipeTags.map(normalizeAllergenToken));
  // Also match custom free-text flags against ingredient blob
  const blob = blobFrom(recipe).toLowerCase();
  const hits: string[] = [];
  for (const f of flags) {
    if (recipeSet.has(f)) {
      hits.push(f);
      continue;
    }
    // Custom: substring match on spaces form
    const plain = f.replace(/_/g, " ");
    if (plain.length >= 3 && blob.includes(plain)) hits.push(f);
  }
  return [...new Set(hits)];
}

export function hasAllergenConflict(
  recipe: Parameters<typeof conflictingAllergens>[0],
  userFlags: string[] | string | null | undefined
): boolean {
  return conflictingAllergens(recipe, userFlags).length > 0;
}

/** Soft demote conflicting recipes in suggestion scoring. */
export const ALLERGEN_CONFLICT_PENALTY = 25;
