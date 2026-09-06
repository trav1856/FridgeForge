"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CATALOG_CHIPS,
  FAT_CONTENT_OPTIONS,
  PANTRY_UNITS,
  fatTagFromSelection,
  findCatalogItem,
  itemsForChip,
  suggestedUnitForCategory,
  type CatalogChip,
  type CatalogItem,
} from "@/lib/pantry-catalog";
import {
  defaultUnitForItem,
  unitsForItem,
  type MeasureKind,
} from "@/lib/units";
import {
  mergeCatalogWithCustoms,
  type CustomStapleDTO,
} from "@/lib/custom-staples-shared";

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

type SelectableItem = CatalogItem & {
  customId?: string;
  isCustom?: boolean;
};

const emptyDetails = {
  tags: "",
  barcode: "",
  expirationDate: "",
  fatContent: "" as string,
};

const OTHER_UNIT = "__other__";

export function ManualPantryIntake({
  editingId,
  editForm,
  onCancelEdit,
  onSaved,
}: Props) {
  const [chipId, setChipId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectableItem | null>(null);
  const [customName, setCustomName] = useState("");
  /** Blank until user enters — never prefilled from catalog. */
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("each");
  const [customUnit, setCustomUnit] = useState("");
  const [details, setDetails] = useState(emptyDetails);
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customs, setCustoms] = useState<CustomStapleDTO[]>([]);
  const [manageOpen, setManageOpen] = useState(false);

  const chip: CatalogChip | null = useMemo(
    () => CATALOG_CHIPS.find((c) => c.id === chipId) ?? null,
    [chipId]
  );

  const loadCustoms = useCallback(async (category?: string) => {
    const qs = category
      ? `?category=${encodeURIComponent(category)}`
      : "";
    try {
      const res = await fetch(`/api/pantry/staples${qs}`);
      if (!res.ok) return;
      const data = (await res.json()) as CustomStapleDTO[];
      setCustoms(Array.isArray(data) ? data : []);
    } catch {
      /* ignore offline */
    }
  }, []);

  useEffect(() => {
    if (chip?.category) {
      void loadCustoms(chip.category);
    } else {
      setCustoms([]);
    }
  }, [chip?.category, loadCustoms]);

  const catalogItems: SelectableItem[] = useMemo(() => {
    if (!chip) return [];
    const staticItems = itemsForChip(chip);
    // Customs filtered by the chip's stored category (Proteins, Produce, Baking, …).
    const forCategory = customs.filter(
      (c) => !c.hidden && c.category === chip.category
    );
    return mergeCatalogWithCustoms(staticItems, forCategory);
  }, [chip, customs]);

  const name = selected?.name || customName.trim();
  const category = selected?.category || chip?.category || "Other";
  const measureKind = selected?.measureKind as MeasureKind | undefined;

  const unitOptions = useMemo(
    () => unitsForItem(name, category, measureKind),
    [name, category, measureKind]
  );

  const unitSelectValue = useMemo(() => {
    if (unitOptions.includes(unit)) return unit;
    if (unit && unit !== "each") return OTHER_UNIT;
    return unitOptions[0] ?? "each";
  }, [unit, unitOptions]);

  const showFatContent =
    chip?.category === "Proteins" ||
    selected?.category === "Proteins" ||
    /beef|turkey|pork|chicken|meat|ground/i.test(
      selected?.name || customName || ""
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

  function applyDefaultUnit(
    itemName: string,
    itemCategory: string,
    suggested?: string | null,
    kind?: MeasureKind | null
  ) {
    setUnit(defaultUnitForItem(itemName, itemCategory, suggested, kind));
    setCustomUnit("");
  }

  function pickChip(c: CatalogChip) {
    setChipId(c.id);
    setSelected(null);
    setCustomName("");
    setQuantity("");
    applyDefaultUnit("", c.category, suggestedUnitForCategory(c.category));
    setDetails((d) => ({ ...d, fatContent: "" }));
    setError(null);
  }

  function pickItem(item: SelectableItem) {
    setSelected(item);
    setCustomName("");
    setQuantity("");
    applyDefaultUnit(
      item.name,
      item.category,
      item.suggestedUnit,
      item.measureKind
    );
    setError(null);
  }

  function useCustom() {
    setSelected(null);
    if (chip) {
      setQuantity("");
    }
  }

  function onCustomNameChange(value: string) {
    useCustom();
    setCustomName(value);
    if (chip) {
      const catalogHit = findCatalogItem(value);
      applyDefaultUnit(
        value,
        catalogHit?.category || chip.category,
        catalogHit?.suggestedUnit,
        catalogHit?.measureKind
      );
    }
  }

  async function hideCustom(id: string) {
    try {
      const res = await fetch(`/api/pantry/staples/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: true }),
      });
      if (!res.ok) return;
      if (selected?.customId === id) {
        setSelected(null);
        setQuantity("");
      }
      if (chip?.category) await loadCustoms(chip.category);
    } catch {
      /* ignore */
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) {
      setError("Pick a catalog item or enter a custom name");
      return;
    }
    const qtyNum = Number(quantity);
    if (!quantity.trim() || !Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Enter a quantity (e.g. 8)");
      return;
    }
    const resolvedUnit =
      unitSelectValue === OTHER_UNIT
        ? customUnit.trim() || "each"
        : unit.trim() || unitOptions[0] || "each";
    setSaving(true);
    try {
      const tags = details.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const fatTag = fatTagFromSelection(details.fatContent);
      if (fatTag && !tags.some((t) => t.startsWith("fat:"))) {
        tags.push(fatTag);
      }
      const payload = {
        name,
        quantity: qtyNum,
        unit: resolvedUnit,
        category,
        tags,
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
      setQuantity("");
      setUnit(chip ? suggestedUnitForCategory(chip.category) : "each");
      setCustomUnit("");
      setDetails(emptyDetails);
      setMoreOpen(false);
      if (chip?.category) await loadCustoms(chip.category);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    } finally {
      setSaving(false);
    }
  }

  const managedCustoms = customs.filter((c) => c.category === chip?.category);

  return (
    <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-sage-900">
          Add to pantry
        </h2>
        <p className="mt-1 text-sm text-sage-600">
          Pick a category, tap a staple, then enter weight/size and how many —
          or add your own (customs stay under that category).
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
                  <div key={`${item.isCustom ? "c" : "s"}-${item.name}`} className="relative">
                    <button
                      type="button"
                      onClick={() => pickItem(item)}
                      className={
                        active
                          ? "w-full rounded-xl border-2 border-ember-500 bg-ember-50 px-3 py-2.5 text-left text-sm font-semibold text-ember-900"
                          : "w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-sage-800 hover:border-sage-300 hover:bg-cream-50"
                      }
                    >
                      <span className="block leading-snug pr-4">{item.name}</span>
                      {item.isCustom ? (
                        <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-sage-500">
                          yours
                        </span>
                      ) : null}
                    </button>
                    {item.isCustom && item.customId ? (
                      <button
                        type="button"
                        title="Hide custom staple"
                        aria-label={`Hide ${item.name}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void hideCustom(item.customId!);
                        }}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-sage-400 hover:bg-sage-100 hover:text-sage-800"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
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
              onChange={(e) => onCustomNameChange(e.target.value)}
              onFocus={useCustom}
              placeholder={`Custom ${chip.label.toLowerCase()} item…`}
            />
            <p className="mt-1 text-xs text-sage-500">
              Saved customs reappear under {chip.label} next time.
            </p>
          </div>

          {(selected || customName.trim()) && (
            <>
              <div>
                <p className="label">3. How much?</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="pantry-qty">
                      Quantity
                    </label>
                    <input
                      id="pantry-qty"
                      className="input"
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      value={quantity}
                      placeholder="e.g. 8"
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="pantry-unit">
                      Unit
                    </label>
                    <select
                      id="pantry-unit"
                      className="input"
                      value={unitSelectValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === OTHER_UNIT) {
                          setUnit(customUnit || "");
                        } else {
                          setUnit(v);
                          setCustomUnit("");
                        }
                      }}
                    >
                      {unitOptions.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      <option value={OTHER_UNIT}>other…</option>
                    </select>
                    {unitSelectValue === OTHER_UNIT && (
                      <input
                        className="input mt-2"
                        value={customUnit}
                        onChange={(e) => {
                          setCustomUnit(e.target.value);
                          setUnit(e.target.value);
                        }}
                        placeholder="Custom unit"
                        aria-label="Custom unit"
                      />
                    )}
                  </div>
                </div>
              </div>

              {showFatContent && (
                <div>
                  <label className="label" htmlFor="fat-content">
                    Fat content (optional, meats)
                  </label>
                  <select
                    id="fat-content"
                    className="input max-w-xs"
                    value={details.fatContent}
                    onChange={(e) =>
                      setDetails({ ...details, fatContent: e.target.value })
                    }
                  >
                    <option value="">— blank —</option>
                    {FAT_CONTENT_OPTIONS.filter((o) => o !== "").map((o) => (
                      <option key={o} value={o}>
                        {o === "other" ? "Other" : o}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                        setDetails({
                          ...details,
                          expirationDate: e.target.value,
                        })
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
                    {name}
                    {quantity
                      ? ` · ${quantity} ${
                          unitSelectValue === OTHER_UNIT
                            ? customUnit || "…"
                            : unit
                        }`
                      : ""}{" "}
                    · {category}
                    {details.fatContent
                      ? ` · fat ${details.fatContent}`
                      : ""}
                  </span>
                )}
              </div>
            </>
          )}

          {managedCustoms.length > 0 && (
            <details
              className="rounded-xl border border-sage-200 bg-white"
              open={manageOpen}
              onToggle={(e) =>
                setManageOpen((e.target as HTMLDetailsElement).open)
              }
            >
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-sage-800">
                Manage custom staples ({managedCustoms.filter((c) => !c.hidden).length} in{" "}
                {chip.label})
              </summary>
              <ul className="space-y-1 border-t border-sage-100 px-3 py-2">
                {managedCustoms.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 text-sm text-sage-800"
                  >
                    <span>
                      {c.name}
                      {c.hidden ? (
                        <span className="ml-1 text-xs text-sage-500">(hidden)</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-ember-700 hover:underline"
                      onClick={() => void hideCustom(c.id)}
                      disabled={c.hidden}
                    >
                      {c.hidden ? "Hidden" : "Hide"}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
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

  const editUnitOptions = useMemo(
    () => unitsForItem(form.name, form.category),
    [form.name, form.category]
  );

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
          <select
            className="input"
            value={
              editUnitOptions.includes(form.unit) ||
              PANTRY_UNITS.includes(form.unit as never)
                ? form.unit
                : form.unit
            }
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          >
            {Array.from(
              new Set([...editUnitOptions, form.unit, ...PANTRY_UNITS])
            )
              .filter(Boolean)
              .map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
          </select>
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
