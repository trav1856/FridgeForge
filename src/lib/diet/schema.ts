import { z } from "zod";
import { DIET_IDS } from "@/lib/diet/rules";

export const dietSettingsSchema = z
  .object({
    dietType: z.enum(DIET_IDS as [string, ...string[]]),
    kcalTarget: z.number().int().min(500).max(10000),
    mealsPerDay: z.number().int().min(2).max(5),
    split: z.tuple([z.number().int().min(0).max(100), z.number().int().min(0).max(100), z.number().int().min(0).max(100)]).nullable().optional(),
    disclaimerAccepted: z.literal(true),
    birthDate: z.string().max(20).optional(),
  })
  .strict();

export const dietPlanActionSchema = z
  .object({
    action: z.enum(["build", "regenerate", "lock", "unlock", "portion", "swap", "alternatives"]),
    dayIndex: z.number().int().min(0).max(6).optional(),
    slot: z.enum(["breakfast", "lunch", "dinner", "snack1", "snack2"]).optional(),
    recipeId: z.string().max(64).optional(),
    portion: z.number().optional(),
  })
  .strict();
