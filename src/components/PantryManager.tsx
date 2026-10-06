"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarcodeIntake } from "./BarcodeIntake";
import { ManualPantryIntake } from "./ManualPantryIntake";
import { ReceiptIntake } from "./ReceiptIntake";
import { PantryItemTile } from "./PantryItemTile";

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
  imageUrl?: string | null;
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
  imageUrl?: string | null;
};

export function PantryManager() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<IntakeTab>("barcode");
  // null = unknown yet; false = guest / no household (read-only pantry).
  const [canSave, setCanSave] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const households = data?.user?.households;
        setCanSave(Array.isArray(households) && households.length > 0);
      })
      .catch(() => {
        if (!cancelled) setCanSave(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
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
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Remove this pantry item?")) return;
    setNotice(null);
    try {
      const res = await fetch(`/api/pantry/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(
          res.status === 401
            ? typeof data?.error === "string"
              ? data.error
              : "Sign in to save your pantry."
            : "Could not remove that item."
        );
        if (res.status === 401) setCanSave(false);
        return;
      }
    } catch {
      setNotice("Could not remove that item.");
      return;
    }
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
      imageUrl: item.imageUrl ?? null,
    });
    // Bring the edit form into view after tab switch
    requestAnimationFrame(() => {
      document
        .getElementById("pantry-edit-anchor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      {canSave === false && (
        <div
          role="status"
          data-testid="pantry-signin-banner"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5"
        >
          <p className="font-semibold">Sign in to save your pantry</p>
          <p className="mt-0.5 text-xs text-amber-800">
            You&apos;re browsing as a guest, so this pantry is read-only.{" "}
            <Link href="/account" className="font-semibold underline">
              Sign in or create an account
            </Link>{" "}
            to keep your own.
          </p>
        </div>
      )}
      {notice && (
        <div
          role="alert"
          data-testid="pantry-notice"
          className="flex items-start justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5"
        >
          <span>
            {notice}
            {canSave === false && (
              <>
                {" "}
                <Link href="/account" className="font-semibold underline">
                  Sign in
                </Link>
              </>
            )}
          </span>
          <button
            type="button"
            className="text-xs font-medium text-amber-700 hover:text-amber-900"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}
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

      <div id="pantry-edit-anchor" />
      {tab === "manual" && (
        <ManualPantryIntake
          editingId={editingId}
          editForm={editForm}
          onCancelEdit={clearEdit}
          onItemsChanged={() => {
            void load({ quiet: true });
          }}
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-sage-900">
            Your pantry ({items.length})
          </h2>
          <p className="mt-0.5 text-xs text-sage-600">
            Photo tiles — tap a square to edit quantity.
          </p>
        </div>
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
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {list.map((item) => (
                  <PantryItemTile
                    key={item.id}
                    item={item}
                    onEdit={startEdit}
                    onRemove={(id) => void remove(id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
