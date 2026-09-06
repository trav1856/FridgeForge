"use client";

import { useCallback, useEffect, useState } from "react";
import { BarcodeIntake } from "./BarcodeIntake";
import { ManualPantryIntake } from "./ManualPantryIntake";
import { ReceiptIntake } from "./ReceiptIntake";
import { formatNutritionBlurb } from "@/lib/open-food-facts";

type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  tags: string[];
  barcode?: string | null;
  expirationDate: string | null;
  nutritionJson?: string | null;
};

type IntakeTab = "barcode" | "manual";

type EditForm = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  tags: string;
  barcode: string;
  expirationDate: string;
};

export function PantryManager() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<IntakeTab>("barcode");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pantry");
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not load pantry");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load pantry");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Remove this pantry item?")) return;
    await fetch(`/api/pantry/${id}`, { method: "DELETE" });
    await load();
  }

  function startEdit(item: PantryItem) {
    setTab("manual");
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      category: item.category || "Other",
      tags: item.tags.join(", "),
      barcode: item.barcode || "",
      expirationDate: item.expirationDate
        ? item.expirationDate.slice(0, 10)
        : "",
    });
  }

  function clearEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  const filtered = items.filter((i) => {
    const q = filter.toLowerCase();
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      (i.category || "").toLowerCase().includes(q) ||
      (i.barcode || "").includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const byCategory = filtered.reduce<Record<string, PantryItem[]>>((acc, i) => {
    const c = i.category || "Other";
    (acc[c] ??= []).push(i);
    return acc;
  }, {});

  const tabs: { id: IntakeTab; label: string }[] = [
    { id: "barcode", label: "Scan barcode" },
    { id: "manual", label: "Manual" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sage-200/80 bg-gradient-to-br from-cream-50 to-sage-50/60 px-4 py-3 sm:px-5">
        <p className="text-sm font-medium text-sage-800">
          Scan the barcode when you get home — we will look it up and drop it in
          your pantry.
        </p>
        <p className="mt-1 text-xs text-sage-600">
          Prefer typing? Use Manual anytime — pick a category, tap a staple, then
          enter how much. Receipt import lives under Advanced.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl bg-sage-100/70 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-sage-900 shadow-sm"
                : "flex-1 rounded-xl px-3 py-2 text-sm font-medium text-sage-600 hover:text-sage-900"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "barcode" && <BarcodeIntake onAdded={load} />}

      {tab === "manual" && (
        <ManualPantryIntake
          editingId={editingId}
          editForm={editForm}
          onCancelEdit={clearEdit}
          onSaved={async () => {
            clearEdit();
            setError(null);
            await load();
          }}
        />
      )}

      {error && tab !== "manual" && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <details className="group rounded-2xl border border-dashed border-sage-300/80 bg-sage-50/40 open:bg-cream-50/60">
        <summary className="cursor-pointer list-none px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-sage-800">
                Advanced: try receipt (experimental)
              </p>
              <p className="mt-0.5 text-xs text-sage-600">
                OCR from photos is unreliable — expect typos and missed lines.
                Prefer barcode when you can.
              </p>
            </div>
            <span className="mt-0.5 shrink-0 text-xs font-medium text-sage-500 group-open:hidden">
              Show
            </span>
            <span className="mt-0.5 hidden shrink-0 text-xs font-medium text-sage-500 group-open:inline">
              Hide
            </span>
          </div>
        </summary>
        <div className="border-t border-sage-200/60 px-2 pb-2 pt-1 sm:px-3">
          <ReceiptIntake onAdded={load} />
        </div>
      </details>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-sage-900">
          Your pantry ({items.length})
        </h2>
        <input
          className="input max-w-[200px]"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-sage-600">Loading pantry…</p>
      ) : filtered.length === 0 ? (
        <p className="card p-6 text-center text-sage-600">
          No items yet. Scan a barcode or add a staple to unlock smart
          suggestions.
        </p>
      ) : (
        <div className="space-y-5">
          {Object.entries(byCategory).map(([cat, list]) => (
            <section key={cat}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-sage-500">
                {cat}
              </h3>
              <ul className="space-y-2">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className="card flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="font-semibold text-sage-900">
                        {item.name}
                      </div>
                      <div className="text-sm text-sage-600">
                        {item.quantity} {item.unit}
                        {item.barcode && (
                          <span className="ml-2 font-mono text-xs text-sage-500">
                            · #{item.barcode}
                          </span>
                        )}
                        {item.expirationDate && (
                          <span className="ml-2 text-ember-700">
                            · exp {item.expirationDate.slice(0, 10)}
                          </span>
                        )}
                      </div>
                      {item.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.tags.map((t) => (
                            <span
                              key={t}
                              className="badge bg-sage-100 text-sage-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {formatNutritionBlurb(item.nutritionJson) && (
                        <p className="mt-1 text-xs text-sage-500">
                          {formatNutritionBlurb(item.nutritionJson)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs text-red-700"
                        onClick={() => remove(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
