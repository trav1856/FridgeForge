import type { PrismaClient } from "@prisma/client";

/**
 * Parse recipe.tags JSON and return true if it includes staple or classic.
 */
export function isStapleOrClassicTagJson(tagsJson: string | null | undefined): boolean {
  try {
    const tags = JSON.parse(tagsJson || "[]") as unknown;
    if (!Array.isArray(tags)) return false;
    return tags.some(
      (t) =>
        typeof t === "string" &&
        (t.toLowerCase() === "staple" || t.toLowerCase() === "classic")
    );
  } catch {
    return false;
  }
}

/**
 * Clone global (householdId null) recipes tagged staple or classic
 * into a newly created household, including ingredients.
 */
export async function cloneStapleRecipesToHousehold(
  prisma: PrismaClient,
  householdId: string
): Promise<number> {
  const globals = await prisma.recipe.findMany({
    where: { householdId: null },
    include: { ingredients: true },
  });

  const staples = globals.filter((r) => isStapleOrClassicTagJson(r.tags));
  let cloned = 0;

  for (const r of staples) {
    await prisma.recipe.create({
      data: {
        title: r.title,
        description: r.description,
        steps: r.steps,
        costTier: r.costTier,
        tags: r.tags,
        servings: r.servings,
        cookTimeMinutes: r.cookTimeMinutes,
        sourceUrl: r.sourceUrl,
        imageUrl: r.imageUrl,
        isStruggleMeal: r.isStruggleMeal,
        techniqueTips: r.techniqueTips,
        flavorBoosters: r.flavorBoosters,
        householdId,
        ingredients: {
          create: r.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            optional: i.optional,
          })),
        },
      },
    });
    cloned += 1;
  }

  return cloned;
}
