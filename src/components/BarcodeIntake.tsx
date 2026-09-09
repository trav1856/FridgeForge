"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { PANTRY_CATEGORIES } from "@/lib/categories";

type LookupResult = {
  found: boolean;
  barcode: string;
  name?: string;
  brand?: string | null;
  quantityHint?: string | null;
  suggestedCategory?: string;
  suggestedUnit?: string;
  imageUrl?: string | null;
  isLikelyNonFood?: boolean;
};

type ConfirmForm = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  barcode: string;
  imageUrl?: string | null;
};

type NonFoodPending = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  barcode: string;
  imageUrl?: string | null;
};

const emptyConfirm: ConfirmForm = {
  name: "",
  quantity: "1",
  unit: "each",
  category: "Other",
  barcode: "",
  imageUrl: null,
};

type Props = { onAdded: () => void };

export function BarcodeIntake({ onAdded }: Props) {
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmForm | null>(null);
  const [nonFoodPending, setNonFoodPending] = useState<NonFoodPending | null>(
    null
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);
  const lastScanned = useRef<string>("");

  useEffect(() => {
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopScanner() {
    const inst = html5QrRef.current;
    html5QrRef.current = null;
    if (inst) {
      try {
        await inst.stop();
        inst.clear();
      } catch {
        /* already stopped */
      }
    }
    setScanning(false);
  }

  async function startScanner() {
    setError(null);
    setStatus(null);
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise((r) => setTimeout(r, 50));
      if (!scannerRef.current) throw new Error("Scanner mount missing");

      const scanner = new Html5Qrcode("barcode-reader");
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 140 } },
        (decoded) => {
          const code = decoded.trim();
          if (!code || code === lastScanned.current) return;
          lastScanned.current = code;
          void stopScanner().then(() => lookup(code));
        },
        () => {
          /* ignore frame miss */
        }
      );
      setStatus("Point your camera at a product barcode");
    } catch (err) {
      setScanning(false);
      setError(
        err instanceof Error
          ? `Camera unavailable: ${err.message}. Use manual entry below.`
          : "Camera unavailable. Use manual entry below."
      );
    }
  }

  async function addToPantry(payload: {
    name: string;
    quantity: number;
    unit: string;
    category: string | null;
    barcode: string | null;
    imageUrl?: string | null;
  }) {
    const res = await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name.trim(),
        quantity: payload.quantity || 1,
        unit: payload.unit.trim() || "each",
        category: payload.category || null,
        barcode: payload.barcode || null,
        imageUrl: payload.imageUrl || null,
        merge: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not add item");
    const label = data.item?.name || payload.name;
    setStatus(
      data.merged
        ? `Merged into “${label}” in your pantry`
        : `Added “${label}” to your pantry`
    );
    setConfirm(null);
    setNotFound(false);
    setNonFoodPending(null);
    setManualCode("");
    setImageUrl(null);
    lastScanned.current = "";
    onAdded();
    return data;
  }

  async function lookup(code: string) {
    const cleaned = code.replace(/\D/g, "") || code.trim();
    if (!cleaned) {
      setError("Enter a barcode");
      return;
    }
    setLookingUp(true);
    setError(null);
    setNotFound(false);
    setConfirm(null);
    setNonFoodPending(null);
    setImageUrl(null);
    setStatus(`Looking up ${cleaned}…`);
    try {
      const res = await fetch(
        `/api/barcode/lookup?barcode=${encodeURIComponent(cleaned)}`
      );
      const data = (await res.json()) as LookupResult & { error?: string };

      // Network/OFF failure: still create an unknown item (user intent).
      if (!res.ok && res.status !== 502) {
        throw new Error(data.error || "Lookup failed");
      }

      if (data.found && data.name) {
        setImageUrl(data.imageUrl || null);
        const draft = {
          name: data.name,
          quantity: "1",
          unit: data.suggestedUnit || "each",
          category: data.suggestedCategory || "Other",
          barcode: data.barcode || cleaned,
          imageUrl: data.imageUrl || null,
        };

        if (data.isLikelyNonFood) {
          setNonFoodPending(draft);
          setStatus(
            `This looks like a non-food item (“${data.name}”). Confirm to add it.`
          );
          return;
        }

        setStatus(
          data.brand
            ? `Found via Open Food Facts · ${data.brand} — adding…`
            : "Found via Open Food Facts — adding…"
        );
        await addToPantry({
          name: draft.name,
          quantity: 1,
          unit: draft.unit,
          category: draft.category,
          barcode: draft.barcode,
          imageUrl: draft.imageUrl,
        });
        return;
      }

      // Unknown / unmatched barcode — still create, no non-food scare.
      const unknownName = `Unknown product (UPC ${cleaned})`;
      setNotFound(true);
      setStatus(`No product match — adding “${unknownName}”…`);
      await addToPantry({
        name: unknownName,
        quantity: 1,
        unit: "each",
        category: "Other",
        barcode: data.barcode || cleaned,
        imageUrl: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
      setStatus(null);
    } finally {
      setLookingUp(false);
    }
  }

  function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    void lookup(manualCode);
  }

  async function onConfirmSubmit(e: FormEvent) {
    e.preventDefault();
    if (!confirm?.name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);
    setLookingUp(true);
    try {
      await addToPantry({
        name: confirm.name.trim(),
        quantity: Number(confirm.quantity) || 1,
        unit: confirm.unit.trim() || "each",
        category: confirm.category || null,
        barcode: confirm.barcode || null,
        imageUrl: confirm.imageUrl || imageUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setLookingUp(false);
    }
  }

  async function acceptNonFood() {
    if (!nonFoodPending) return;
    setLookingUp(true);
    setError(null);
    try {
      await addToPantry({
        name: nonFoodPending.name,
        quantity: Number(nonFoodPending.quantity) || 1,
        unit: nonFoodPending.unit,
        category: nonFoodPending.category,
        barcode: nonFoodPending.barcode,
        imageUrl: nonFoodPending.imageUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setLookingUp(false);
    }
  }

  function declineNonFood() {
    setNonFoodPending(null);
    setStatus("Cancelled — nothing added to pantry.");
    setImageUrl(null);
    lastScanned.current = "";
  }

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl font-bold text-sage-900">
          Scan barcode
        </h2>
        <p className="mt-1 text-sm text-sage-600">
          Scan the barcode when you get home — camera or type the UPC/EAN. Food
          products land in your pantry right away; non-food items ask first.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!scanning ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void startScanner()}
            disabled={lookingUp}
          >
            Open camera
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void stopScanner()}
          >
            Stop camera
          </button>
        )}
      </div>

      <div
        id="barcode-reader"
        ref={scannerRef}
        className={
          scanning
            ? "overflow-hidden rounded-xl border border-sage-200 bg-black/90"
            : "hidden"
        }
      />

      <form onSubmit={onManualSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label className="label">Or enter barcode</label>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 3017620422003"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="btn-secondary w-full sm:w-auto"
            disabled={lookingUp || !manualCode.trim()}
          >
            Look up
          </button>
        </div>
      </form>

      {status && (
        <p className="text-sm text-sage-700" role="status">
          {status}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {nonFoodPending && (
        <div
          role="alertdialog"
          aria-labelledby="nonfood-title"
          className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          <h3
            id="nonfood-title"
            className="text-sm font-bold text-amber-950"
          >
            Non-food product
          </h3>
          {nonFoodPending.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nonFoodPending.imageUrl}
              alt=""
              className="h-16 w-16 rounded-lg object-cover"
            />
          )}
          <p className="text-sm text-amber-950">
            This is a {nonFoodPending.name}. Are you sure you want this in your
            pantry?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={lookingUp}
              onClick={() => void acceptNonFood()}
            >
              {lookingUp ? "Saving…" : "Yes, add it"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={lookingUp}
              onClick={declineNonFood}
            >
              No, cancel
            </button>
          </div>
        </div>
      )}

      {confirm && !nonFoodPending && (
        <form
          onSubmit={onConfirmSubmit}
          className="space-y-3 rounded-xl border border-cream-300 bg-cream-50/80 p-3"
        >
          <h3 className="text-sm font-bold uppercase tracking-wide text-sage-600">
            {notFound ? "Added — edit name if needed" : "Confirm & add"}
          </h3>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-16 w-16 rounded-lg object-cover"
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Name</label>
              <input
                className="input"
                required
                value={confirm.name}
                onChange={(e) =>
                  setConfirm({ ...confirm, name: e.target.value })
                }
                placeholder="Product name"
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
                value={confirm.quantity}
                onChange={(e) =>
                  setConfirm({ ...confirm, quantity: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Unit</label>
              <input
                className="input"
                value={confirm.unit}
                onChange={(e) =>
                  setConfirm({ ...confirm, unit: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={confirm.category}
                onChange={(e) =>
                  setConfirm({ ...confirm, category: e.target.value })
                }
              >
                {PANTRY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Barcode</label>
              <input
                className="input bg-sage-50"
                readOnly
                value={confirm.barcode}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={lookingUp}>
            {lookingUp ? "Saving…" : "Save changes to pantry"}
          </button>
        </form>
      )}
    </div>
  );
}
