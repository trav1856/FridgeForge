"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RecipeImage } from "./RecipeImage";

/** Keep in sync with RECIPE_USER_IMAGE_MAX_BYTES in recipe-user-images.ts */
const RECIPE_USER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  /** Existing recipe: upload immediately to API. */
  recipeId?: string;
  /** Current stored image URL (remote or managed). */
  imageUrl?: string | null;
  alt?: string;
  /** Create-form: keep File locally until recipe is saved. */
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
  onImageUrlChange?: (url: string | null) => void;
  /** When false, only show take/upload/remove controls (detail page already has hero). */
  showPreview?: boolean;
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
  if (file.size > RECIPE_USER_IMAGE_MAX_BYTES) {
    return `Image must be ${RECIPE_USER_IMAGE_MAX_BYTES / (1024 * 1024)}MB or smaller.`;
  }
  return null;
}

/**
 * Take photo (camera) + Upload photo (gallery) for recipes.
 * Mirrors ReceiptIntake capture + badge FormData upload patterns.
 */
export function RecipePhotoUpload({
  recipeId,
  imageUrl = null,
  alt = "Recipe photo",
  pendingFile = null,
  onPendingFileChange,
  onImageUrlChange,
  showPreview = true,
  className = "",
}: Props) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(imageUrl);

  useEffect(() => {
    setDisplayUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  async function handleFile(file: File | null) {
    setError(null);
    if (!file) return;
    const invalid = clientValidate(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    // Create flow: stash file for post-create upload
    if (!recipeId) {
      onPendingFileChange?.(file);
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/recipes/${recipeId}/image`, {
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
        (data.recipe?.imageUrl as string | null | undefined) ??
        null;
      setDisplayUrl(next);
      onImageUrlChange?.(next);
      onPendingFileChange?.(null);
      router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  async function onRemove() {
    setError(null);
    if (!recipeId) {
      onPendingFileChange?.(null);
      onImageUrlChange?.(null);
      setDisplayUrl(null);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/image`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Could not remove photo"
        );
        return;
      }
      setDisplayUrl(null);
      onImageUrlChange?.(null);
      router.refresh();
    } catch {
      setError("Could not remove photo");
    } finally {
      setBusy(false);
    }
  }

  const shown = previewUrl || displayUrl;

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <p className="label mb-1">Recipe photo</p>
        <p className="text-xs text-sage-600">
          Take a picture with your camera or choose one from your gallery.
        </p>
      </div>

      {showPreview && shown && (
        <div className="max-w-sm">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={alt}
              className="h-36 w-full rounded-xl bg-cream-100 object-cover sm:h-48"
            />
          ) : (
            <RecipeImage src={displayUrl} alt={alt} variant="hero" />
          )}
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
        {(shown || pendingFile) && (
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={busy}
            onClick={() => void onRemove()}
          >
            Remove photo
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

/** Upload a pending file after recipe create; returns new imageUrl or error. */
export async function uploadRecipePhotoAfterCreate(
  recipeId: string,
  file: File
): Promise<{ ok: true; imageUrl: string | null } | { ok: false; error: string }> {
  const invalid = clientValidate(file);
  if (invalid) return { ok: false, error: invalid };
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/recipes/${recipeId}/image`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error:
          typeof data.error === "string" ? data.error : "Image upload failed",
      };
    }
    return {
      ok: true,
      imageUrl:
        (data.imageUrl as string | null | undefined) ??
        (data.recipe?.imageUrl as string | null | undefined) ??
        null,
    };
  } catch {
    return { ok: false, error: "Image upload failed" };
  }
}
