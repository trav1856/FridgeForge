"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { BoundingBoxPicker } from "./BoundingBoxPicker";
import { RecipeForm, type RecipeFormDraft } from "./RecipeForm";
import { fullPageBox, type NormBox } from "@/lib/recipe-import-crop";

type Phase = "upload" | "box" | "review";

type OcrResponse = {
  rawText?: string;
  draft?: RecipeFormDraft;
  structureSource?: string;
  structureModel?: string | null;
  error?: string | unknown;
  pageImageUrl?: string | null;
};

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}

/** Client-side crop preview (and optional upload of pre-cropped bytes). */
async function cropToBlob(
  imageUrl: string,
  box: NormBox
): Promise<{ blob: Blob; objectUrl: string }> {
  const img = await loadImageElement(imageUrl);
  const sx = Math.floor(box.x * img.naturalWidth);
  const sy = Math.floor(box.y * img.naturalHeight);
  const sw = Math.max(1, Math.ceil(box.w * img.naturalWidth));
  const sh = Math.max(1, Math.ceil(box.h * img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Crop failed"))),
      "image/png"
    );
  });
  return { blob, objectUrl: URL.createObjectURL(blob) };
}

export function RecipePageImport() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [pageFile, setPageFile] = useState<File | null>(null);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [box, setBox] = useState<NormBox | null>(null);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [showOcr, setShowOcr] = useState(false);
  const [draft, setDraft] = useState<RecipeFormDraft | null>(null);
  const [structureMeta, setStructureMeta] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    return () => {
      if (pageUrl) URL.revokeObjectURL(pageUrl);
      if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replacePageUrl = useCallback((next: string | null) => {
    setPageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next;
    });
  }, []);

  const replaceCropUrl = useCallback((next: string | null) => {
    setCropPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next;
    });
  }, []);

  function resetToBoxKeepPage() {
    setPhase("box");
    setBox(null);
    replaceCropUrl(null);
    setRawText("");
    setDraft(null);
    setStructureMeta(null);
    setError(null);
    setStatus("Draw a box around the next recipe on this page.");
    setShowOcr(false);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a photo or image of the cookbook page.");
      return;
    }
    setError(null);
    setPageFile(file);
    replacePageUrl(URL.createObjectURL(file));
    replaceCropUrl(null);
    setBox(null);
    setDraft(null);
    setRawText("");
    setPhase("box");
    setStatus("Draw a bounding box around one recipe.");
  }

  useEffect(() => {
    let cancelled = false;
    async function preview() {
      if (!pageUrl || !box) {
        replaceCropUrl(null);
        return;
      }
      try {
        const { objectUrl } = await cropToBlob(pageUrl, box);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        replaceCropUrl(objectUrl);
      } catch {
        if (!cancelled) replaceCropUrl(null);
      }
    }
    void preview();
    return () => {
      cancelled = true;
    };
  }, [pageUrl, box, replaceCropUrl]);

  const canRunOcr = useMemo(
    () => !!pageFile && !!pageUrl && !!box && !busy,
    [pageFile, pageUrl, box, busy]
  );

  async function runOcrAndStructure() {
    if (!pageFile || !box) return;
    setBusy(true);
    setError(null);
    setStatus("OCR + structuring recipe… this can take a minute.");
    try {
      const form = new FormData();
      form.append("image", pageFile);
      form.append("box", JSON.stringify(box));
      form.append("persistPage", "1");
      const res = await fetch("/api/recipes/import/ocr", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as OcrResponse;
      if (!res.ok) {
        if (typeof data.rawText === "string") setRawText(data.rawText);
        setShowOcr(true);
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "OCR / structure failed"
        );
      }
      setRawText(data.rawText || "");
      if (!data.draft) throw new Error("No recipe draft returned");
      setDraft(data.draft);
      setFormKey((k) => k + 1);
      const metaParts = [
        data.structureSource === "ollama"
          ? `Structured with Ollama${data.structureModel ? ` (${data.structureModel})` : ""}`
          : "Structured with heuristic parser",
      ];
      setStructureMeta(metaParts.join(" · "));
      setPhase("review");
      setStatus("Review the draft — nothing is saved until you confirm.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function restructureFromOcrText() {
    if (!rawText.trim() || rawText.trim().length < 20) {
      setError("OCR text is too short to parse.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Re-parsing OCR text…");
    try {
      // Reuse paste parse endpoint as a light restructure without re-OCR
      const res = await fetch("/api/recipes/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not re-parse"
        );
      }
      setDraft({
        title: data.recipe.title,
        description: data.recipe.description ?? null,
        ingredients: data.recipe.ingredients,
        steps: data.recipe.steps,
        cookTimeMinutes: data.recipe.cookTimeMinutes ?? null,
      });
      setFormKey((k) => k + 1);
      setStructureMeta("Re-parsed from edited OCR text");
      setPhase("review");
      setStatus("Review the updated draft — nothing is saved until you confirm.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-parse failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-sage-900">
              Scan a cookbook page
            </h2>
            <p className="mt-1 text-sm text-sage-600">
              Photograph or upload a printed page, draw one box around the recipe
              you want, then review the draft before saving. Multiple recipes on
              a page? Box them one at a time.
            </p>
          </div>
          <Link href="/recipes/new" className="btn-ghost text-sm">
            URL / manual instead
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer">
            {pageFile ? "Replace photo" : "Upload or take photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={busy}
              onChange={onFileChange}
            />
          </label>
          {phase === "box" && (
            <button
              type="button"
              className="btn-primary"
              disabled={!canRunOcr}
              onClick={() => void runOcrAndStructure()}
            >
              {busy ? "Working…" : "OCR this crop"}
            </button>
          )}
          {phase === "box" && !box && pageUrl && (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setBox(fullPageBox())}
            >
              Use full page
            </button>
          )}
        </div>

        {status && (
          <p className="rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-800">
            {status}
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-ember-50 px-3 py-2 text-sm text-ember-800">
            {error}
          </p>
        )}
        {structureMeta && phase === "review" && (
          <p className="text-xs text-sage-500">{structureMeta}</p>
        )}
        {savedCount > 0 && (
          <p className="text-xs font-medium text-sage-700">
            Saved {savedCount} recipe{savedCount === 1 ? "" : "s"} from this
            page this session.
          </p>
        )}
      </div>

      {pageUrl && phase !== "upload" && (
        <div className="card space-y-3 p-4 sm:p-5">
          <h3 className="font-display text-base font-bold text-sage-900">
            {phase === "review" ? "Page (for next recipe)" : "Select recipe area"}
          </h3>
          <BoundingBoxPicker
            imageUrl={pageUrl}
            box={box}
            onBoxChange={setBox}
            disabled={busy || phase === "review"}
          />
          {cropPreviewUrl && phase === "box" && (
            <div>
              <p className="label">Crop preview</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropPreviewUrl}
                alt="Selected crop"
                className="mt-1 max-h-48 rounded-lg border border-cream-300 object-contain"
              />
            </div>
          )}
        </div>
      )}

      {(rawText || phase === "review") && (
        <div className="card space-y-2 p-4 sm:p-5">
          <button
            type="button"
            className="btn-ghost px-0 text-sm"
            onClick={() => setShowOcr((v) => !v)}
          >
            {showOcr ? "Hide OCR text" : "Show OCR text"}
          </button>
          {showOcr && (
            <div className="space-y-2">
              <textarea
                className="input min-h-[140px] font-mono text-xs"
                value={rawText}
                disabled={busy}
                onChange={(e) => setRawText(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={busy || !rawText.trim()}
                onClick={() => void restructureFromOcrText()}
              >
                Re-parse OCR text
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "review" && draft && (
        <div className="space-y-4">
          <div className="rounded-xl border border-sage-200 bg-cream-100/80 px-4 py-3 text-sm text-sage-800">
            Review and edit below, then save. FridgeForge never auto-publishes
            scanned recipes.
          </div>
          <RecipeForm
            key={formKey}
            initialDraft={draft}
            hideUrlImport
            stayAfterSave
            onSaved={() => {
              setSavedCount((n) => n + 1);
              resetToBoxKeepPage();
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={resetToBoxKeepPage}
            >
              Another recipe on this page?
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setPhase("box");
                setStatus("Adjust the box and run OCR again.");
              }}
            >
              Back to box
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
