"use client";

import { useId, useRef, useState } from "react";
import { validateBarcode } from "@/lib/barcode";

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** Called with a valid canonical code after a decode or a confirmed entry. */
  onConfirmed?: (code: string) => void;
};

/** Decode a barcode from a still photo: native BarcodeDetector, else html5-qrcode (already used for live scan). */
async function decodeBarcodePhoto(file: File, elementId: string): Promise<string | null> {
  type Detector = { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> };
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (BD) {
    try {
      const bmp = await createImageBitmap(file);
      const hits = await new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }).detect(bmp);
      if (hits[0]?.rawValue) return hits[0].rawValue;
    } catch {
      /* fall through */
    }
  }
  try {
    const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
    const h = new Html5Qrcode(elementId, {
      verbose: false,
      formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E],
    });
    try {
      return (await h.scanFile(file, false)).trim();
    } finally {
      h.clear();
    }
  } catch {
    return null;
  }
}

export function BarcodePhotoField({ value, onChange, onConfirmed }: Props) {
  const rid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const elId = `barcode-photo-${rid}`;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const check = value.trim() ? validateBarcode(value) : null;

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setNote("Reading barcode…");
    const code = await decodeBarcodePhoto(file, elId);
    setBusy(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    if (!code) {
      setNote("Couldn't read that barcode. Type the numbers under the bars instead.");
      return;
    }
    const digits = code.replace(/\D/g, "");
    onChange(digits);
    const v = validateBarcode(digits);
    setNote(v.ok ? `Read ${digits}. Check it matches the label.` : `Read ${digits}, but ${v.error.toLowerCase()}`);
    if (v.ok) onConfirmed?.(v.code);
  }

  return (
    <div className="space-y-2" data-testid="barcode-photo-field">
      <label className="label" htmlFor={`${elId}-input`}>Barcode (optional)</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${elId}-input`}
          className="input flex-1"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (check?.ok) onConfirmed?.(check.code);
          }}
          placeholder="UPC / EAN"
          aria-invalid={check ? !check.ok : undefined}
          data-testid="barcode-input"
        />
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => cameraRef.current?.click()}>
            {busy ? "Reading…" : "Photo of barcode"}
          </button>
          <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => galleryRef.current?.click()}>
            Upload
          </button>
        </div>
      </div>
      {check && !check.ok && <p className="text-xs text-red-600" data-testid="barcode-error">{check.error}</p>}
      {check?.ok && <p className="text-xs text-sage-600">Valid {check.kind}</p>}
      {note && <p className="text-xs text-sage-700" role="status" data-testid="barcode-note">{note}</p>}
      <div id={elId} className="hidden" aria-hidden />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        data-testid="barcode-photo-camera" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden"
        data-testid="barcode-photo-upload" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
    </div>
  );
}
