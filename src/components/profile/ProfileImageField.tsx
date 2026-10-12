"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type Kind = "avatar" | "banner";

const HINTS: Record<Kind, string> = {
  avatar: "Square works best, at least 400 × 400. It's cropped to a circle; use zoom and position to fit.",
  banner: "Wide image, at least 1500 × 500 (3:1). Use position to choose what shows; phones show the middle.",
};

/** Upload/replace a profile picture or banner with a crop preview. Crop happens on the server. */
export function ProfileImageField({
  kind,
  currentUrl,
  disabled,
  onChanged,
}: {
  kind: Kind;
  currentUrl: string | null;
  disabled?: boolean;
  onChanged: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fx, setFx] = useState(0.5);
  const [fy, setFy] = useState(0.5);
  const [busy, setBusy] = useState(false);
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
    if (f && f.size > 8 * 1024 * 1024) {
      setError("Image must be 8MB or smaller.");
      return;
    }
    if (f && !/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setError("Image must be JPEG, PNG or WebP.");
      return;
    }
    setZoom(1);
    setFx(0.5);
    setFy(0.5);
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("zoom", String(zoom));
      fd.set("focusX", String(fx));
      fd.set("focusY", String(fy));
      const res = await fetch(`/api/profile/images/${kind}`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed.");
        return;
      }
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onChanged(data.url);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile/images/${kind}`, { method: "DELETE" });
      if (res.ok) onChanged(null);
      else setError("Could not remove the image.");
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? currentUrl;
  const frame =
    kind === "avatar"
      ? "h-24 w-24 rounded-full"
      : "aspect-[3/1] w-full max-w-[18rem] rounded-xl";

  return (
    <div className="space-y-3 rounded-2xl border-2 border-dashed border-sage-200 bg-sage-50/60 p-4" data-testid={`image-field-${kind}`}>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={clsx(
            "relative shrink-0 overflow-hidden bg-gradient-to-br",
            kind === "avatar" ? "from-ember-300 to-ember-700" : "from-ember-200 via-cream-200 to-sage-200",
            frame
          )}
        >
          {shown && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt=""
              className="h-full w-full object-cover"
              style={
                preview
                  ? {
                      objectPosition: `${fx * 100}% ${fy * 100}%`,
                      transform: `scale(${zoom})`,
                      transformOrigin: `${fx * 100}% ${fy * 100}%`,
                    }
                  : undefined
              }
            />
          )}
          {preview && (
            <div
              aria-hidden
              className={clsx(
                "pointer-events-none absolute border-2 border-dashed border-white/90",
                kind === "avatar" ? "inset-[6%] rounded-full" : "inset-y-[6%] left-[22%] right-[22%] rounded-lg"
              )}
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className={clsx("btn-secondary cursor-pointer px-3 py-1.5 text-sm", (busy || disabled) && "pointer-events-none opacity-50")}>
              {currentUrl ? (kind === "avatar" ? "Change photo" : "Change banner") : kind === "avatar" ? "Upload photo" : "Upload banner"}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy || disabled}
                data-testid={`image-input-${kind}`}
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
            </label>
            {currentUrl && !file && (
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={remove} disabled={busy || disabled}>
                Remove
              </button>
            )}
          </div>
          <p className="text-xs leading-snug text-sage-500">{HINTS[kind]}</p>
        </div>
      </div>
      {file && (
        <div className="space-y-2 rounded-xl bg-white/80 p-3">
          <p className="text-xs font-semibold text-sage-700">Crop: the dashed outline shows the safe area.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-sage-600">
              Zoom
              <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-full accent-ember-600" />
            </label>
            <label className="text-xs text-sage-600">
              Left ↔ right
              <input type="range" min={0} max={1} step={0.01} value={fx} onChange={(e) => setFx(+e.target.value)} className="w-full accent-ember-600" />
            </label>
            <label className="text-xs text-sage-600">
              Top ↕ bottom
              <input type="range" min={0} max={1} step={0.01} value={fy} onChange={(e) => setFy(+e.target.value)} className="w-full accent-ember-600" />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={upload} disabled={busy} data-testid={`image-save-${kind}`}>
              {busy ? "Uploading…" : "Save image"}
            </button>
            <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => pick(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs font-medium text-ember-700" role="alert">{error}</p>}
    </div>
  );
}
