"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PANTRY_CATEGORIES } from "@/lib/categories";
import { BarcodeIntake } from "./BarcodeIntake";
import { ReceiptIntake } from "./ReceiptIntake";

type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  tags: string[];
  barcode?: string | null;
  expirationDate: string | null;
};

type IntakeTab = "manual" | "barcode" | "receipt";

const emptyForm = {
  name: "",
  quantity: "1",
  unit: "each",
  category: "Other",
  tags: "",
  barcode: "",
  expirationDate: "",
};

export function PantryManager() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<IntakeTab>("manual");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pantry");
      const data = await res.json();
      setItems(data);
    } catch {
      setError("Could not load pantry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name.trim(),
      quantity: Number(form.quantity) || 1,
      unit: form.unit.trim() || "each",
      category: form.category || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      barcode: form.barcode.trim() || null,
      expirationDate: form.expirationDate
        ? new Date(form.expirationDate).toISOString()
        : null,
      merge: !editingId,
    };

    try {
      const res = await fetch(
        editingId ? `/api/pantry/${editingId}` : "/api/pantry",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Save failed");
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch {
      setError("Could not save item");
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this pantry item?")) return;
    await fetch(`/api/pantry/${id}`, { method: "DELETE" });
    await load();
  }

  function startEdit(item: PantryItem) {
    setTab("manual");
    setEditingId(item.id);
    setForm({
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
    { id: "manual", label: "Manual" },
    { id: "barcode", label: "Barcode" },
    { id: "receipt", label: "Receipt" },
  ];

  return (
    <div className="space-y-6">
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
      {tab === "receipt" && <ReceiptIntake onAdded={load} />}

      {tab === "manual" && (
        <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-3">
          <h2 className="font-display text-xl font-bold text-sage-900">
            {editingId ? "Edit item" : "Add to pantry"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Name</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Jasmine rice"
              />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input
                className="input"
                type="number"
                min="0.01"
                step="any"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Unit</label>
              <input
                className="input"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="cups, cans, each…"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {PANTRY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Expires (optional)</label>
              <input
                className="input"
                type="date"
                value={form.expirationDate}
                onChange={(e) =>
                  setForm({ ...form, expirationDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Barcode (optional)</label>
              <input
                className="input"
                inputMode="numeric"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder="UPC / EAN"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Tags (comma-separated)</label>
              <input
                className="input"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="staple, struggle, fridge"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "Save changes" : "Add item"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

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
          No items yet. Add staples to unlock smart suggestions.
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
