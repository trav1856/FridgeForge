import { z } from "zod";

export const adminNutritionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("recompute") }).strict(),
  z.object({ action: z.literal("servings"), recipeId: z.string().min(1).max(64), suspect: z.boolean(), note: z.string().max(300).optional() }).strict(),
]);
