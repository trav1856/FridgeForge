import { z } from "zod";
import type { PantrySnapshot } from "./types";

/**
 * A guest's browser-local demo pantry, sent to read-only calculation
 * endpoints (suggestions, deals, weekly menu). Only used when the caller has
 * no household; never stored.
 */
const itemSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().min(1).max(120),
  quantity: z.number().min(0).max(100000),
  unit: z.string().max(40).default("each"),
  category: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export const guestPantrySchema = z.array(itemSchema).max(300);

export function parseGuestPantry(raw: unknown): PantrySnapshot[] {
  const parsed = guestPantrySchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.map((p, i) => ({
    id: p.id || `guest-${i}`,
    name: p.name,
    quantity: p.quantity,
    unit: p.unit || "each",
    category: p.category ?? null,
    tags: p.tags ?? [],
    barcode: null,
    nutritionJson: null,
  }));
}
