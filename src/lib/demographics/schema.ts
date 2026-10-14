import { z } from "zod";

export const demographicsSchema = z
  .object({
    sex: z.enum(["male", "female", ""]).nullable().optional(),
    ethnicities: z.array(z.string().max(40)).max(40).optional(),
    originCountries: z.array(z.string().max(4)).max(40).optional(),
    researchConsent: z.boolean().optional(),
    birthDate: z.string().max(20).optional(),
  })
  .strict();
