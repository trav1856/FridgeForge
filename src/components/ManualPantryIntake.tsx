"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CATALOG_CHIPS,
  PANTRY_UNITS,
  itemsForChip,
  type CatalogChip,
  type CatalogItem,
} from "@/lib/pantry-catalog";

type EditForm = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  tags: string;
  barcode: string;
  expirationDate: string;
};

type Props = {
  editingId: string | null;
  editForm: EditForm | null;
  onCancelEdit: () => void;
  onSaved: () => void;
};

const emptyDetails = {
  tags: "",
  barcode: "",
  expirationDate: "",
};

export function ManualPantryIntake({
  editingId,
  editForm,
  onCancelEdit,
  onSaved,
}: Props) {
  const [chipId, setChipId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [customName, setCustomName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [details, setDetails] = useState(emptyDetails);
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chip: CatalogChip | null = useMemo(
    () => CATALOG_CHIPS.find((c) => c.id === chipId) ?? null,
    [chipId]
  );

  const catalogItems = useMemo(
    () => (chip ? itemsForChip(chip) : []),
    [chip]
  );

  // Edit mode: classic full form
  if (editingId && editForm) {
    return (
      <EditPantryForm
        key={editingId}
        editingId={editingId}
        form={editForm}
        onCancel={onCancelEdit}
        onSaved={onSaved}
      />
    );
  }

  function pickChip(c: CatalogChip) {
    setChipId(c.id);
    setSelected(null);
    setCustomName("");
    setQuantity("1");
    setUnit("each");
    setError(null);
  }

  function pickItem(item: CatalogItem) {
    setSelected(item);
    setCustomName("");
    setQuantity(String(item.defaultQty));
    setUnit(item.defaultUnit);
    setError(null);
  }

  function useCustom() {
    setSelected(null);
    if (chip) {
      setQuantity("1");
      setUnit("each");
    }
  }

  const name = selected?.name || customName.trim();
  const category = selected?.category || chip?.category || "Other";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) {
      setError("Pick a catalog item or enter a custom name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        quantity: Number(quantity) || 1,
        unit: unit.trim() || "each",
        category,
        tags: details.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        barcode: details.barcode.trim() || null,
        expirationDate: details.expirationDate
          ? new Date(details.expirationDate).toISOString()
          : null,
        merge: true,
      };
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error;
        throw new Error(typeof msg === "string" ? msg : "Save failed");
      }
      setSelected(null);
      setCustomName("");
      setQuantity("1");
      setUnit("each");
      setDetails(emptyDetails);
      setMoreOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-sage-900">
          Add to pantry
        </h2>
        <p className="mt-1 text-sm text-sage-600">
          Pick a category, tap a staple, set qty — or add your own.
        </p>
      </div>

      <div>
        <p className="label">1. Category</p>
        <div className="flex flex-wrap gap-2">
          {CATALOG_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickChip(c)}
              className={
                chipId === c.id
                  ? "rounded-full bg-ember-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
                  : "rounded-full border border-sage-200 bg-cream-50 px-3.5 py-2 text-sm font-medium text-sage-800 hover:border-sage-300 hover:bg-white"
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {chip && (
        <>
          <div>
            <p className="label">2. Common items</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {catalogItems.map((item) => {
                const active = selected?.name === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => pickItem(item)}
                    className={
                      active
                        ? "rounded-xl border-2 border-ember-500 bg-ember-50 px-3 py-2.5 text-left text-sm font-semibold text-ember-900"
                        : "rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-sage-800 hover:border-sage-300 hover:bg-cream-50"
                    }
                  >
                    <span className="block leading-snug">{item.name}</span>
                    <span className="mt-0.5 block text-xs font-normal text-sage-500">
                      {item.defaultQty} {item.defaultUnit}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="custom-pantry-name">
              Add your own
            </label>
            <input
              id="custom-pantry-name"
              className="input"
              value={customName}
              onChange={(e) => {
                useCustom();
                setCustomName(e.target.value);
              }}
              onFocus={useCustom}
              placeholder={`Custom ${chip.label.toLowerCase()} item…`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Quantity</label>
              <input
                className="input"
                type="number"
                min="0.01"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Unit</label>
              <select
                className="input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {PANTRY_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                {!PANTRY_UNITS.includes(unit as never) && unit && (
                  <option value={unit}>{unit}</option>
                )}
              </select>
            </div>
          </div>

          <details
            className="rounded-xl border border-dashed border-sage-300/80 bg-sage-50/40"
            open={moreOpen}
            onToggle={(e) =>
              setMoreOpen((e.target as HTMLDetailsElement).open)
            }
          >
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-sage-800">
              More details
            </summary>
            <div className="grid gap-3 border-t border-sage-200/60 px-3 pb-3 pt-2 sm:grid-cols-2">
              <div>
                <label className="label">Expires (optional)</label>
                <input
                  className="input"
                  type="date"
                  value={details.expirationDate}
                  onChange={(e) =>
                    setDetails({ ...details, expirationDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Barcode (optional)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={details.barcode}
                  onChange={(e) =>
                    setDetails({ ...details, barcode: e.target.value })
                  }
                  placeholder="UPC / EAN"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Tags (comma-separated)</label>
                <input
                  className="input"
                  value={details.tags}
                  onChange={(e) =>
                    setDetails({ ...details, tags: e.target.value })
                  }
                  placeholder="staple, fridge"
                />
              </div>
            </div>
          </details>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !name}
            >
              {saving ? "Adding…" : "Add item"}
            </button>
            {name && (
              <span className="text-xs text-sage-600">
                {name} · {quantity} {unit} · {category}
              </span>
            )}
          </div>
        </>
      )}
    </form>
  );
}

function EditPantryForm({
  editingId,
  form: initial,
  onCancel,
  onSaved,
}: {
  editingId: string;
  form: EditForm;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
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
      };
      const res = await fetch(`/api/pantry/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error;
        throw new Error(typeof msg === "string" ? msg : "Save failed");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-3">
      <h2 className="font-display text-xl font-bold text-sage-900">Edit item</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
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
          />
        </div>
        <div>
          <label className="label">Category</label>
          <input
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
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
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Tags (comma-separated)</label>
          <input
            className="input"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary">
          Save changes
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
