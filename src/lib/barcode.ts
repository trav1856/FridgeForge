/**
 * GTIN helpers for UPC-A (12), EAN-13 (13) and EAN-8 (8). Pure (client + server).
 * Canonical key: EAN-13 with a leading 0 is the same product as its UPC-A, so it
 * is stored as the 12-digit UPC-A.
 */
export type BarcodeKind = "UPC-A" | "EAN-13" | "EAN-8";

export type BarcodeCheck =
  | { ok: true; code: string; kind: BarcodeKind }
  | { ok: false; error: string };

/** GS1 check digit for the given payload (all digits except the last). */
export function gtinCheckDigit(payload: string): number {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const d = payload.charCodeAt(payload.length - 1 - i) - 48;
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

export function validateBarcode(input: string | null | undefined): BarcodeCheck {
  const raw = String(input ?? "").replace(/[\s-]/g, "");
  if (!raw) return { ok: false, error: "Enter a barcode." };
  if (!/^\d+$/.test(raw)) return { ok: false, error: "Barcodes are digits only." };
  const kind: BarcodeKind | null =
    raw.length === 12 ? "UPC-A" : raw.length === 13 ? "EAN-13" : raw.length === 8 ? "EAN-8" : null;
  if (!kind) {
    return { ok: false, error: "Use a 12-digit UPC-A, 13-digit EAN-13 or 8-digit EAN-8." };
  }
  const expected = gtinCheckDigit(raw.slice(0, -1));
  if (expected !== Number(raw[raw.length - 1])) {
    return { ok: false, error: "That barcode's check digit doesn't match. Re-check the numbers." };
  }
  const code = kind === "EAN-13" && raw.startsWith("0") ? raw.slice(1) : raw;
  return { ok: true, code, kind: code.length === 12 ? "UPC-A" : kind };
}

/** Canonical barcode or null when invalid. */
export function canonicalBarcode(input: string | null | undefined): string | null {
  const r = validateBarcode(input);
  return r.ok ? r.code : null;
}
