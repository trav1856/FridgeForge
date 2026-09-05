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
};

type ConfirmForm = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  barcode: string;
};

const emptyConfirm: ConfirmForm = {
  name: "",
  quantity: "1",
  unit: "each",
  category: "Other",
  barcode: "",
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
    setImageUrl(null);
    setStatus(`Looking up ${cleaned}…`);
    try {
      const res = await fetch(
        `/api/barcode/lookup?barcode=${encodeURIComponent(cleaned)}`
      );
      const data = (await res.json()) as LookupResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Lookup failed");

      if (data.found && data.name) {
        setConfirm({
          name: data.name,
          quantity: "1",
          unit: data.suggestedUnit || "each",
          category: data.suggestedCategory || "Other",
          barcode: data.barcode || cleaned,
        });
        setImageUrl(data.imageUrl || null);
        setStatus(
          data.brand
            ? `Found via Open Food Facts · ${data.brand}`
            : "Found via Open Food Facts"
        );
        setNotFound(false);
      } else {
        setNotFound(true);
        setConfirm({
          ...emptyConfirm,
          barcode: data.barcode || cleaned,
          name: "",
        });
        setStatus(
          "No product match — add it manually and we’ll remember the barcode."
        );
      }
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
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: confirm.name.trim(),
          quantity: Number(confirm.quantity) || 1,
          unit: confirm.unit.trim() || "each",
          category: confirm.category || null,
          barcode: confirm.barcode || null,
          merge: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add item");
      setStatus(
        data.merged
          ? `Merged into existing “${data.item.name}”`
          : `Added “${data.item.name}” to pantry`
      );
      setConfirm(null);
      setNotFound(false);
      setManualCode("");
      setImageUrl(null);
      lastScanned.current = "";
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl font-bold text-sage-900">
          Scan barcode
        </h2>
        <p className="mt-1 text-sm text-sage-600">
          Scan the barcode when you get home — camera or type the UPC/EAN. We
          look it up on Open Food Facts, you confirm, and it lands in your
          pantry.
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

      {confirm && (
        <form
          onSubmit={onConfirmSubmit}
          className="space-y-3 rounded-xl border border-cream-300 bg-cream-50/80 p-3"
        >
          <h3 className="text-sm font-bold uppercase tracking-wide text-sage-600">
            {notFound ? "Add manually" : "Confirm & add"}
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
            {lookingUp ? "Saving…" : "Add to pantry"}
          </button>
        </form>
      )}
    </div>
  );
}
