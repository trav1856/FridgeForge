/** Client helpers for item photos + shared product records (server pantry only). */
export async function uploadItemPhoto(itemId: string, file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/pantry/${itemId}/image`, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Photo upload failed");
  return data.imageUrl ?? null;
}

export async function contributeProduct(itemId: string): Promise<string | null> {
  const res = await fetch("/api/products/contribute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
  });
  const data = await res.json().catch(() => ({}));
  switch (data.result) {
    case "created":
      return "Saved as the shared product for this barcode.";
    case "override":
      return "Saved for your kitchen. The shared product info is unchanged.";
    case "rate_limited":
      return "Saved to your pantry. Shared product limit reached for now.";
    default:
      return null;
  }
}

export type ProductLookup = {
  found: boolean;
  barcode: string;
  name?: string;
  suggestedUnit?: string;
  suggestedQuantity?: number | null;
  suggestedCategory?: string;
  imageUrl?: string | null;
  source?: "household" | "shared" | "openfoodfacts" | null;
};

export async function lookupBarcode(code: string): Promise<ProductLookup | null> {
  const res = await fetch(`/api/barcode/lookup?barcode=${encodeURIComponent(code)}`);
  if (!res.ok) return null;
  return (await res.json()) as ProductLookup;
}
