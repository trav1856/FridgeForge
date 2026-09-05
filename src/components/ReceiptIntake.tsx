"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { PANTRY_CATEGORIES } from "@/lib/categories";
import type { ParsedReceiptItem } from "@/lib/receipt-parse";

type ReviewItem = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  selected: boolean;
  confidence: ParsedReceiptItem["confidence"];
  rawLine: string;
};

type Props = { onAdded: () => void };

function toReview(items: ParsedReceiptItem[]): ReviewItem[] {
  return items.map((item, i) => ({
    id: `${i}-${item.name}`,
    name: item.name,
    quantity: String(item.quantity),
    unit: item.unit || "each",
    category: "Other",
    selected: item.confidence !== "low",
    confidence: item.confidence,
    rawLine: item.rawLine,
  }));
}

export function ReceiptIntake({ onAdded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function parseText(text: string) {
    const res = await fetch("/api/receipt/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Parse failed");
    const items = (data.items || []) as ParsedReceiptItem[];
    setReview(toReview(items));
    if (items.length === 0) {
      setStatus(
        "No grocery lines detected. Try pasting clearer text or edit the OCR output."
      );
      setShowPaste(true);
    } else {
      setStatus(
        `Found ${items.length} possible item${items.length === 1 ? "" : "s"} — review before adding.`
      );
    }
  }

  async function runOcr(file: File) {
    setBusy(true);
    setError(null);
    setStatus("Reading receipt with on-device OCR…");
    setReview([]);
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setStatus(
              `OCR ${Math.round(m.progress * 100)}% — keep this tab open`
            );
          }
        },
      });
      const text = result.data.text || "";
      setOcrText(text);
      if (!text.trim()) {
        setShowPaste(true);
        setStatus("OCR returned little text. Paste receipt text instead.");
        return;
      }
      await parseText(text);
    } catch (err) {
      setShowPaste(true);
      setError(
        err instanceof Error
          ? `OCR failed: ${err.message}. You can paste text instead.`
          : "OCR failed. Paste text instead."
      );
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void runOcr(file);
    e.target.value = "";
  }

  async function onPasteParse(e: FormEvent) {
    e.preventDefault();
    if (!ocrText.trim()) {
      setError("Paste some receipt text first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await parseText(ocrText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  function updateItem(id: string, patch: Partial<ReviewItem>) {
    setReview((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  async function bulkAdd() {
    const selected = review.filter((r) => r.selected && r.name.trim());
    if (selected.length === 0) {
      setError("Select at least one item");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pantry/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected.map((r) => ({
            name: r.name.trim(),
            quantity: Number(r.quantity) || 1,
            unit: r.unit.trim() || "each",
            category: r.category || "Other",
            tags: ["receipt"],
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk add failed");
      setStatus(
        `Added ${data.added} new · merged ${data.merged} existing pantry items`
      );
      setReview([]);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk add failed");
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = review.filter((r) => r.selected).length;

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl font-bold text-sage-900">
          Scan receipt
        </h2>
        <p className="mt-1 text-sm text-sage-600">
          Upload or capture a photo. We run best-effort OCR in your browser
          (Tesseract.js), then heuristic line parsing. Paste text if OCR is
          weak.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Upload / camera
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => setShowPaste((v) => !v)}
        >
          {showPaste ? "Hide paste" : "Paste text instead"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Receipt preview"
          className="max-h-40 rounded-xl border border-sage-200 object-contain"
        />
      )}

      {showPaste && (
        <form onSubmit={onPasteParse} className="space-y-2">
          <label className="label">Receipt text</label>
          <textarea
            className="input min-h-[140px] font-mono text-xs"
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            placeholder={"Milk 2%\nEggs large 12ct  3.49\n2x Rice  ..."}
          />
          <button type="submit" className="btn-secondary" disabled={busy}>
            Parse text
          </button>
        </form>
      )}

      {status && (
        <p className="text-sm text-sage-700" role="status">
          {status}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {review.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-sage-600">
              Review checklist ({selectedCount}/{review.length})
            </h3>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() =>
                  setReview((rows) => rows.map((r) => ({ ...r, selected: true })))
                }
              >
                All
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() =>
                  setReview((rows) =>
                    rows.map((r) => ({ ...r, selected: false }))
                  )
                }
              >
                None
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {review.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-cream-300 bg-cream-50/70 p-3"
              >
                <div className="mb-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-ember-600"
                    checked={item.selected}
                    onChange={(e) =>
                      updateItem(item.id, { selected: e.target.checked })
                    }
                  />
                  <div className="min-w-0 flex-1 grid gap-2 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <label className="label">Name</label>
                      <input
                        className="input"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(item.id, { name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Qty</label>
                      <input
                        className="input"
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, { quantity: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Unit</label>
                      <input
                        className="input"
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(item.id, { unit: e.target.value })
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Category</label>
                      <select
                        className="input"
                        value={item.category}
                        onChange={(e) =>
                          updateItem(item.id, { category: e.target.value })
                        }
                      >
                        {PANTRY_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2 text-[11px] text-sage-500">
                      {item.confidence} confidence
                      {item.rawLine ? ` · “${item.rawLine.slice(0, 60)}”` : ""}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn-primary"
            disabled={busy || selectedCount === 0}
            onClick={() => void bulkAdd()}
          >
            {busy ? "Adding…" : `Add ${selectedCount} to pantry`}
          </button>
        </div>
      )}
    </div>
  );
}
