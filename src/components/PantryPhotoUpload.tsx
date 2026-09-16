"use client";

import { useEffect, useRef, useState } from "react";
import {
  isBrandPantryImage,
  isUserPantryImage,
  resolvePantryImageUrl,
} from "@/lib/pantry-images";

/** Keep in sync with PANTRY_USER_IMAGE_MAX_BYTES in pantry-user-images.ts */
const PANTRY_USER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  itemId: string;
  /** Current stored image URL (user / OFF / generic). */
  imageUrl?: string | null;
  name: string;
  category?: string | null;
  onImageUrlChange?: (url: string | null) => void;
  className?: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/*";

function clientValidate(file: File): string | null {
  const mime = (file.type || "").toLowerCase();
  if (
    mime &&
    !["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"].includes(
      mime
    ) &&
    !mime.startsWith("image/")
  ) {
    return "Image must be JPEG, PNG, WebP, or GIF.";
  }
  if (file.size <= 0) return "Empty image file.";
  if (file.size > PANTRY_USER_IMAGE_MAX_BYTES) {
    return `Image must be ${PANTRY_USER_IMAGE_MAX_BYTES / (1024 * 1024)}MB or smaller.`;
  }
  return null;
}

/**
 * Take photo (camera) + Upload photo (gallery) for pantry tiles.
 * Mirrors RecipePhotoUpload; writes to /api/pantry/[id]/image.
 */
export function PantryPhotoUpload({
  itemId,
  imageUrl = null,
  name,
  category = null,
  onImageUrlChange,
  className = "",
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(imageUrl);

  useEffect(() => {
    setDisplayUrl(imageUrl);
  }, [imageUrl]);

  const shown = resolvePantryImageUrl({
    name,
    imageUrl: displayUrl,
    category,
  });
  const hasCustom = isUserPantryImage(displayUrl);
  const canReset =
    hasCustom || isBrandPantryImage(displayUrl);

  async function handleFile(file: File | null) {
    setError(null);
    if (!file) return;
    const invalid = clientValidate(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/pantry/${itemId}/image`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Upload failed"
        );
        return;
      }
      const next =
        (data.imageUrl as string | null | undefined) ??
        (data.item?.imageUrl as string | null | undefined) ??
        null;
      setDisplayUrl(next);
      onImageUrlChange?.(next);
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  async function onReset() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/pantry/${itemId}/image`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not reset photo"
        );
        return;
      }
      setDisplayUrl(null);
      onImageUrlChange?.(null);
    } catch {
      setError("Could not reset photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <p className="label mb-1">Pantry photo</p>
        <p className="text-xs text-sage-600">
          Wrong picture? Take a photo or upload one — it replaces the tile
          image until you reset.
        </p>
      </div>

      {shown && (
        <div className="aspect-square h-24 w-24 overflow-hidden rounded-xl bg-sage-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown}
            alt={name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? "Working…" : "Take photo"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
        >
          Upload photo
        </button>
        {canReset && (
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={busy}
            onClick={() => void onReset()}
          >
            Reset to default
          </button>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void handleFile(f);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void handleFile(f);
        }}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
