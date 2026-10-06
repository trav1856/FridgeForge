"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  addLocalShopping,
  clearLocalChecked,
  readLocalShopping,
  removeLocalShopping,
  setLocalChecked,
  sortLocalShopping,
  writeLocalShopping,
} from "@/lib/local-shopping-list";
import { useViewer } from "@/lib/viewer-client";

type Item = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  recipeTitle: string | null;
};

export function ShoppingListView() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const viewer = useViewer();
  // Guests keep their list in this browser (localStorage); nothing is stored server-side.
  const local = viewer?.kind === "guest";

  const load = useCallback(async () => {
    if (viewer == null) return;
    setLoading(true);
    if (local) {
      setItems(sortLocalShopping(readLocalShopping()));
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/shopping-list");
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [viewer, local]);

  useEffect(() => {
    load();
  }, [load]);

  const openItems = useMemo(() => items.filter((i) => !i.checked), [items]);
  const textList = useMemo(() => {
    return openItems
      .map((i) => {
        const qty =
          i.quantity != null
            ? `${i.quantity}${i.unit ? ` ${i.unit}` : ""} `
            : "";
        return `☐ ${qty}${i.name}`;
      })
      .join("\n");
  }, [openItems]);

  async function toggle(id: string, checked: boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked } : i))
    );
    if (local) {
      writeLocalShopping(setLocalChecked(readLocalShopping(), id, checked));
      return;
    }
    await fetch(`/api/shopping-list/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (local) {
      writeLocalShopping(removeLocalShopping(readLocalShopping(), id));
      return;
    }
    await fetch(`/api/shopping-list/${id}`, { method: "DELETE" });
  }

  async function clearChecked() {
    if (local) {
      writeLocalShopping(clearLocalChecked(readLocalShopping()));
      await load();
      return;
    }
    await fetch("/api/shopping-list", { method: "DELETE" });
    await load();
  }

  async function addDraft(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    if (local) {
      writeLocalShopping(
        addLocalShopping(readLocalShopping(), [{ name: draft.trim() }]).items
      );
      setDraft("");
      await load();
      return;
    }
    await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: draft.trim() }] }),
    });
    setDraft("");
    await load();
  }

  async function shareList() {
    const body = `FridgeForge shopping list:\n${textList || "(empty)"}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Shopping list", text: body });
        return;
      } catch {
        // fall through
      }
    }
    try {
      await navigator.clipboard.writeText(body);
      alert("List copied to clipboard");
    } catch {
      alert(body);
    }
  }

  function copyList() {
    const body = `FridgeForge shopping list:\n${textList || "(empty)"}`;
    navigator.clipboard.writeText(body).then(
      () => alert("Copied"),
      () => alert(body)
    );
  }

  const smsHref = `sms:?&body=${encodeURIComponent(
    `FridgeForge list:\n${textList || "(empty)"}`
  )}`;

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-5">
        <h1 className="font-display text-2xl font-bold text-sage-900">
          Shopping list
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          Check items off at the store. Add missing ingredients from Cook Now or
          a recipe. Apple Notes sync is on the roadmap — use share / copy / SMS
          for now.
        </p>
        {local && (
          <p
            className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900"
            data-testid="shopping-local-note"
          >
            Guest list — saved in this browser only.{" "}
            <Link href="/account" className="font-semibold underline">
              Sign in
            </Link>{" "}
            to keep a list you can use on any device.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary text-sm" onClick={shareList}>
            Share list
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={copyList}>
            Copy as text
          </button>
          <a href={smsHref} className="btn-secondary text-sm">
            Text myself (SMS)
          </a>
          <button
            type="button"
            className="btn-ghost text-sm text-sage-600"
            onClick={clearChecked}
          >
            Clear checked
          </button>
        </div>
      </div>

      <form onSubmit={addDraft} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Add an item…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-sage-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="card p-6 text-center text-sage-600">
          List is empty. Add missing staples from Cook Now near-misses.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              data-testid="shopping-item"
              className={`card flex items-start gap-3 p-3 ${
                item.checked ? "opacity-60" : ""
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-sage-800"
                checked={item.checked}
                onChange={(e) => toggle(item.id, e.target.checked)}
                aria-label={`Check off ${item.name}`}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`font-medium text-sage-900 ${
                    item.checked ? "line-through" : ""
                  }`}
                >
                  {item.quantity != null && (
                    <span className="text-sage-600">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}{" "}
                    </span>
                  )}
                  {item.name}
                </div>
                {item.recipeTitle && (
                  <div className="text-xs text-sage-500">
                    for {item.recipeTitle}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn-ghost text-xs text-red-700"
                onClick={() => remove(item.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
