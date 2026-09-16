import { prisma } from "@/lib/db";
import { serializePantry } from "@/lib/mappers";
import {
  canEditPantryItemImage,
  deleteManagedPantryUserImage,
  savePantryUserImageFile,
  validatePantryUserImageUpload,
} from "@/lib/pantry-user-images";

export { canEditPantryItemImage };

export class PantryImageUploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PantryImageUploadError";
    this.status = status;
  }
}

type PantryRow = {
  id: string;
  householdId: string | null;
  imageUrl: string | null;
};

export async function loadPantryItemForImageEdit(
  itemId: string
): Promise<PantryRow> {
  const item = await prisma.pantryItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      householdId: true,
      imageUrl: true,
    },
  });
  if (!item) throw new PantryImageUploadError("Not found", 404);
  return item;
}

export function assertCanEditPantryItemImage(
  item: PantryRow,
  actor: { householdId: string | null }
): void {
  if (!canEditPantryItemImage(item, actor)) {
    throw new PantryImageUploadError("Forbidden", 403);
  }
}

export async function setPantryItemImageFromUpload(
  itemId: string,
  file: { mime: string | null; size: number; bytes: Buffer },
  actor: { householdId: string | null }
) {
  const existing = await loadPantryItemForImageEdit(itemId);
  assertCanEditPantryItemImage(existing, actor);

  const check = validatePantryUserImageUpload({
    mime: file.mime,
    size: file.size,
  });
  if (!check.ok) throw new PantryImageUploadError(check.error, 400);

  const imageUrl = await savePantryUserImageFile(file.bytes, check.ext);
  const updated = await prisma.pantryItem.update({
    where: { id: itemId },
    data: { imageUrl },
  });
  await deleteManagedPantryUserImage(existing.imageUrl);
  return serializePantry(updated);
}

/**
 * Clear custom imageUrl so resolve falls back to generic (or empty → generic).
 * Deletes managed user file if present; leaves remote OFF URLs discarded.
 */
export async function clearPantryItemImage(
  itemId: string,
  actor: { householdId: string | null }
) {
  const existing = await loadPantryItemForImageEdit(itemId);
  assertCanEditPantryItemImage(existing, actor);

  const updated = await prisma.pantryItem.update({
    where: { id: itemId },
    data: { imageUrl: null },
  });
  await deleteManagedPantryUserImage(existing.imageUrl);
  return serializePantry(updated);
}
