"use client";

import { createContext, useContext } from "react";
import {
  addDemoItem,
  removeDemoItem,
  updateDemoItem,
  type DemoPantryInput,
} from "@/lib/demo-pantry";
import { readDemoPantry, writeDemoPantry } from "@/lib/demo-pantry-store";

export type PantryAddPayload = {
  name: string;
  quantity: number;
  unit: string;
  category?: string | null;
  tags?: string[];
  barcode?: string | null;
  expirationDate?: string | null;
  nutritionJson?: string | null;
  imageUrl?: string | null;
  merge?: boolean;
};

export type PantryUpdatePayload = Partial<Omit<PantryAddPayload, "merge">>;

/**
 * Where pantry writes go: the signed-in household (server) or the guest's
 * browser-only demo pantry. Intake components call this instead of fetch.
 */
export type PantryWriter = {
  mode: "server" | "demo";
  add(p: PantryAddPayload): Promise<{ item: { name: string }; merged: boolean }>;
  update(id: string, p: PantryUpdatePayload): Promise<void>;
  remove(id: string): Promise<void>;
  bulkAdd(items: PantryAddPayload[]): Promise<{ added: number; merged: number }>;
};

async function jsonOrThrow(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : fallback);
  }
  return data;
}

export const serverPantryWriter: PantryWriter = {
  mode: "server",
  async add(p) {
    const res = await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    return jsonOrThrow(res, "Could not add item");
  },
  async update(id, p) {
    const res = await fetch(`/api/pantry/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    await jsonOrThrow(res, "Save failed");
  },
  async remove(id) {
    const res = await fetch(`/api/pantry/${id}`, { method: "DELETE" });
    await jsonOrThrow(res, "Delete failed");
  },
  async bulkAdd(items) {
    const res = await fetch("/api/pantry/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    return jsonOrThrow(res, "Bulk add failed");
  },
};

function toDemoInput(p: PantryAddPayload): DemoPantryInput {
  return {
    name: p.name.trim(),
    quantity: Number.isFinite(p.quantity) && p.quantity > 0 ? p.quantity : 1,
    unit: p.unit?.trim() || "each",
    category: p.category ?? null,
    tags: p.tags,
    barcode: p.barcode ?? null,
    expirationDate: p.expirationDate ?? null,
    nutritionJson: p.nutritionJson ?? null,
    imageUrl: p.imageUrl ?? null,
  };
}

/** Guest writes stay in this browser (localStorage). Nothing reaches the server. */
export const demoPantryWriter: PantryWriter = {
  mode: "demo",
  async add(p) {
    const r = addDemoItem(readDemoPantry(), toDemoInput(p));
    writeDemoPantry(r.items);
    return { item: r.item, merged: r.merged };
  },
  async update(id, p) {
    writeDemoPantry(updateDemoItem(readDemoPantry(), id, p));
  },
  async remove(id) {
    writeDemoPantry(removeDemoItem(readDemoPantry(), id));
  },
  async bulkAdd(items) {
    let list = readDemoPantry();
    let added = 0;
    let merged = 0;
    for (const p of items) {
      const r = addDemoItem(list, toDemoInput(p));
      list = r.items;
      if (r.merged) merged += 1;
      else added += 1;
    }
    writeDemoPantry(list);
    return { added, merged };
  },
};

const Ctx = createContext<PantryWriter>(serverPantryWriter);

export const PantryWriterProvider = Ctx.Provider;

export function usePantryWriter(): PantryWriter {
  return useContext(Ctx);
}
