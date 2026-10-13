"use client";

import { useEffect, useRef, useState } from "react";

const MAX = 8 * 1024 * 1024;

/**
 * Stage an item photo before the pantry item exists (camera or upload).
 * The parent uploads it to /api/pantry/[id]/image after saving.
 */
export function ItemPhotoPicker({
  file,
  onFile,
  fallbackUrl,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  /** Prefilled product photo shown when no photo is staged. */
  fallbackUrl?: string | null;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function pick(f: File | null) {
    setError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    if (!f) return;
    if (f.type && !f.type.startsWith("image/")) return setError("Choose an image file.");
    if (f.size > MAX) return setError("Image must be 8MB or smaller.");
    onFile(f);
  }

  const shown = preview ?? fallbackUrl ?? null;
  return (
    <div className="space-y-2" data-testid="item-photo-picker">
      <p className="label mb-0">Item photo (optional)</p>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sage-100">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Item photo preview" className="h-full w-full object-cover" data-testid="item-photo-preview" />
          ) : (
            <div className="grid h-full place-items-center text-[11px] text-sage-500">No photo</div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => cameraRef.current?.click()}>Take photo</button>
          <button type="button" className="btn-ghost text-sm" onClick={() => galleryRef.current?.click()}>Upload</button>
          {file && (
            <button type="button" className="btn-ghost text-sm" onClick={() => onFile(null)}>Remove</button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        data-testid="item-photo-camera" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden"
        data-testid="item-photo-upload" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
    </div>
  );
}
