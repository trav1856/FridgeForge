/**
 * Guest shopping list kept in the browser (localStorage). Guests never write
 * shopping-list rows to the server. Pure helpers + a tiny storage wrapper.
 */
export const LOCAL_SHOPPING_STORAGE_KEY = "ff_guest_shopping_v1";

export type LocalShoppingItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  recipeId: string | null;
  recipeTitle: string | null;
  createdAt: string;
};

export type LocalShoppingInput = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  recipeId?: string | null;
  recipeTitle?: string | null;
};

function clean(raw: unknown): LocalShoppingItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 200) : "";
  if (!name) return null;
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const q = Number(r.quantity);
  return {
    id: str(r.id, 64) ?? `local-${Math.random().toString(36).slice(2, 10)}`,
    name,
    quantity: r.quantity != null && Number.isFinite(q) && q > 0 ? q : null,
    unit: str(r.unit, 40),
    checked: r.checked === true,
    recipeId: str(r.recipeId, 64),
    recipeTitle: str(r.recipeTitle, 200),
    createdAt: str(r.createdAt, 40) ?? new Date(0).toISOString(),
  };
}

export function parseLocalShopping(raw: string | null | undefined): LocalShoppingItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(clean).filter((x): x is LocalShoppingItem => !!x).slice(0, 500);
  } catch {
    return [];
  }
}

let counter = 0;

/** Add items, skipping names already on the list and not yet checked (case-insensitive). */
export function addLocalShopping(
  items: LocalShoppingItem[],
  inputs: LocalShoppingInput[],
  now = new Date()
): { items: LocalShoppingItem[]; added: number } {
  let list = [...items];
  let added = 0;
  for (const input of inputs) {
    const name = input.name.trim();
    if (!name) continue;
    const dupe = list.some(
      (i) => !i.checked && i.name.toLowerCase() === name.toLowerCase()
    );
    if (dupe) continue;
    counter += 1;
    const item = clean({
      ...input,
      name,
      id: `local-${now.getTime().toString(36)}-${counter}`,
      checked: false,
      createdAt: now.toISOString(),
    });
    if (!item) continue;
    list = [item, ...list];
    added += 1;
  }
  return { items: list, added };
}

export function setLocalChecked(items: LocalShoppingItem[], id: string, checked: boolean) {
  return items.map((i) => (i.id === id ? { ...i, checked } : i));
}

export function removeLocalShopping(items: LocalShoppingItem[], id: string) {
  return items.filter((i) => i.id !== id);
}

export function clearLocalChecked(items: LocalShoppingItem[]) {
  return items.filter((i) => !i.checked);
}

/** Same order as the server list: open first, newest first. */
export function sortLocalShopping(items: LocalShoppingItem[]) {
  return [...items].sort((a, b) =>
    a.checked === b.checked
      ? b.createdAt.localeCompare(a.createdAt)
      : a.checked
        ? 1
        : -1
  );
}

export function readLocalShopping(): LocalShoppingItem[] {
  if (typeof window === "undefined") return [];
  try {
    return parseLocalShopping(window.localStorage.getItem(LOCAL_SHOPPING_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeLocalShopping(items: LocalShoppingItem[]) {
  try {
    window.localStorage.setItem(LOCAL_SHOPPING_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage disabled */
  }
}
