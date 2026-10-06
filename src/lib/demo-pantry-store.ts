"use client";

import { useEffect, useState } from "react";
import {
  DEMO_PANTRY_STORAGE_KEY,
  demoPantryFixture,
  parseDemoPantry,
  type DemoPantryItem,
} from "./demo-pantry";

/** Browser-only store for the guest demo pantry (localStorage). */
const EVENT = "ff-demo-pantry-change";

export function readDemoPantry(): DemoPantryItem[] {
  if (typeof window === "undefined") return demoPantryFixture();
  try {
    return parseDemoPantry(window.localStorage.getItem(DEMO_PANTRY_STORAGE_KEY));
  } catch {
    return demoPantryFixture();
  }
}

export function writeDemoPantry(items: DemoPantryItem[]) {
  try {
    window.localStorage.setItem(DEMO_PANTRY_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage full / disabled: keep working in memory for this view */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function resetDemoPantry() {
  try {
    window.localStorage.removeItem(DEMO_PANTRY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Live demo pantry (null until mounted, so SSR and hydration match). */
export function useDemoPantry(enabled = true): DemoPantryItem[] | null {
  const [items, setItems] = useState<DemoPantryItem[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const sync = () => setItems(readDemoPantry());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === DEMO_PANTRY_STORAGE_KEY) sync();
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled]);
  return items;
}
