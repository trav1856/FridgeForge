"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { RecipeImage } from "./RecipeImage";

type Ing = { name: string; quantity: string; unit: string; optional: boolean };

const blankIng = (): Ing => ({
  name: "",
  quantity: "1",
  unit: "each",
  optional: false,
});

function applyRecipeToForm(
  r: {
    title?: string;
    description?: string;
    imageUrl?: string | null;
    cookTimeMinutes?: number | null;
    ingredients?: { name: string; quantity: number; unit: string }[];
    steps?: string[];
  },
  setters: {
    setTitle: (v: string) => void;
    setDescription: (v: string) => void;
    setImageUrl: (v: string | null) => void;
    setCookTimeMinutes: (v: string) => void;
    setIngredients: (v: Ing[]) => void;
    setStepsText: (v: string) => void;
  }
) {
  setters.setTitle(r.title || "");
  setters.setDescription(r.description || "");
  setters.setImageUrl(r.imageUrl || null);
  setters.setCookTimeMinutes(
    r.cookTimeMinutes != null && r.cookTimeMinutes > 0
      ? String(r.cookTimeMinutes)
      : ""
  );
  setters.setIngredients(
    (r.ingredients || []).map((i) => ({
      name: i.name,
      quantity: String(i.quantity ?? 1),
      unit: i.unit || "each",
      optional: false,
    }))
  );
  setters.setStepsText((r.steps || []).join("\n"));
}

export function RecipeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [costTier, setCostTier] = useState<"cheap" | "moderate">("cheap");
  const [tags, setTags] = useState("");
  const [servings, setServings] = useState("2");
  const [cookTimeMinutes, setCookTimeMinutes] = useState("");
  const [isStruggleMeal, setIsStruggleMeal] = useState(true);
  const [stepsText, setStepsText] = useState("");
  const [tipsText, setTipsText] = useState("");
  const [boostersText, setBoostersText] = useState("");
  const [ingredients, setIngredients] = useState<Ing[]>([blankIng()]);
  const [importUrl, setImportUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [suggestPaste, setSuggestPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsingPaste, setParsingPaste] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const formSetters = {
    setTitle,
    setDescription,
    setImageUrl,
    setCookTimeMinutes,
    setIngredients,
    setStepsText,
  };

  async function tryImport() {
    if (importing || !importUrl.trim()) return;
    setImportMsg(null);
    setSuggestPaste(false);
    setImporting(true);
    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err =
          typeof data.error === "string"
            ? data.error
            : "Could not scrape this URL. Paste the recipe below.";
        setImportMsg(err);
        setSuggestPaste(data.suggestPaste === true || data.code === "SITE_BLOCKED");
        setShowPaste(true);
        return;
      }
      applyRecipeToForm(data.recipe, formSetters);
      setSuggestPaste(false);
      setImportMsg(
        data.recipe.imageUrl
          ? "Imported with image — review and save."
          : "Imported — review and save."
      );
    } catch {
      setImportMsg("Import failed. Paste ingredients & steps below.");
      setSuggestPaste(true);
      setShowPaste(true);
    } finally {
      setImporting(false);
    }
  }

  async function tryPasteImport() {
    if (parsingPaste || !pasteText.trim()) return;
    setImportMsg(null);
    setParsingPaste(true);
    try {
      const res = await fetch("/api/recipes/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pasteText.trim(),
          sourceUrl: importUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMsg(
          typeof data.error === "string"
            ? data.error
            : "Could not parse pasted text. Check Ingredients and Directions headers."
        );
        return;
      }
      applyRecipeToForm(data.recipe, formSetters);
      setSuggestPaste(false);
      setImportMsg("Parsed from paste — review and save.");
    } catch {
      setImportMsg("Paste import failed. Try again or fill the form manually.");
    } finally {
      setParsingPaste(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (isStruggleMeal && !tagList.includes("struggle")) tagList.push("struggle");

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      costTier,
      tags: tagList,
      servings: Number(servings) || 2,
      cookTimeMinutes: cookTimeMinutes.trim()
        ? Number(cookTimeMinutes) || null
        : null,
      isStruggleMeal,
      steps,
      techniqueTips: tipsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      flavorBoosters: boostersText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          quantity: Number(i.quantity) || 1,
          unit: i.unit.trim() || "each",
          optional: i.optional,
        })),
      sourceUrl: importUrl.trim() || null,
      imageUrl: imageUrl || null,
    };

    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ? JSON.stringify(data.error) : "Save failed");
      }
      const created = await res.json();
      router.push(`/recipes/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recipe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3 p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Import from URL
        </h2>
        <p className="text-sm text-sage-600">
          Best-effort parse for common recipe sites (JSON-LD / common HTML). Some
          sites intermittently block automated fetches — use Paste recipe if that
          happens.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="https://…"
            value={importUrl}
            disabled={importing}
            onChange={(e) => setImportUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void tryImport();
              }
            }}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!importUrl || importing}
            onClick={tryImport}
          >
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
        {importMsg && (
          <p
            className={`text-sm rounded-lg px-3 py-2 ${
              suggestPaste
                ? "text-ember-800 bg-ember-50"
                : "text-sage-800 bg-sage-50"
            }`}
          >
            {importMsg}
            {suggestPaste && (
              <>
                {" "}
                <button
                  type="button"
                  className="underline font-semibold"
                  onClick={() => setShowPaste(true)}
                >
                  Paste recipe instead
                </button>
              </>
            )}
          </p>
        )}
        {imageUrl && (
          <div className="max-w-sm">
            <RecipeImage src={imageUrl} alt={title || "Imported recipe"} />
          </div>
        )}

        <div className="border-t border-sage-100 pt-3 space-y-2">
          <button
            type="button"
            className="btn-ghost text-sm px-0"
            onClick={() => setShowPaste((v) => !v)}
          >
            {showPaste ? "Hide paste import" : "Paste recipe"}
          </button>
          {showPaste && (
            <div className="space-y-2">
              <p className="text-xs text-sage-600">
                Open the page in your browser → select ingredients &amp; steps
                (or copy all) → paste here. Include headers like{" "}
                <span className="font-mono">Ingredients</span> and{" "}
                <span className="font-mono">Directions</span> when you can.
                {importUrl.trim() ? (
                  <>
                    {" "}
                    <a
                      href={importUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-ember-800"
                    >
                      Open URL in browser
                    </a>
                  </>
                ) : null}
              </p>
              <textarea
                className="input min-h-[160px] font-mono text-xs"
                placeholder={
                  "Lo Mein Noodles\n\nIngredients\n1 (8 ounce) package spaghetti\n3 tablespoons low-sodium soy sauce\n…\n\nDirections\n1. Bring a large pot of water to a boil…\n2. Whisk sauce…"
                }
                value={pasteText}
                disabled={parsingPaste}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={!pasteText.trim() || parsingPaste}
                onClick={tryPasteImport}
              >
                {parsingPaste ? "Parsing…" : "Import paste"}
              </button>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Recipe details
        </h2>
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[72px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Cost tier</label>
            <select
              className="input"
              value={costTier}
              onChange={(e) =>
                setCostTier(e.target.value as "cheap" | "moderate")
              }
            >
              <option value="cheap">Cheap</option>
              <option value="moderate">Moderate</option>
            </select>
          </div>
          <div>
            <label className="label">Servings</label>
            <input
              className="input"
              type="number"
              min="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Cook time (minutes)</label>
            <input
              className="input"
              type="number"
              min="1"
              placeholder="e.g. 30"
              value={cookTimeMinutes}
              onChange={(e) => setCookTimeMinutes(e.target.value)}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={isStruggleMeal}
                onChange={(e) => setIsStruggleMeal(e.target.checked)}
              />
              Struggle meal
            </label>
          </div>
        </div>
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="one-pot, spicy, breakfast"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Ingredients</label>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => setIngredients([...ingredients, blankIng()])}
            >
              + Add
            </button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <input
                  className="input col-span-5"
                  placeholder="Name"
                  value={ing.name}
                  onChange={(e) => {
                    const next = [...ingredients];
                    next[idx] = { ...ing, name: e.target.value };
                    setIngredients(next);
                  }}
                />
                <input
                  className="input col-span-2"
                  placeholder="Qty"
                  value={ing.quantity}
                  onChange={(e) => {
                    const next = [...ingredients];
                    next[idx] = { ...ing, quantity: e.target.value };
                    setIngredients(next);
                  }}
                />
                <input
                  className="input col-span-3"
                  placeholder="Unit"
                  value={ing.unit}
                  onChange={(e) => {
                    const next = [...ingredients];
                    next[idx] = { ...ing, unit: e.target.value };
                    setIngredients(next);
                  }}
                />
                <label className="col-span-2 flex items-center gap-1 text-xs text-sage-600">
                  <input
                    type="checkbox"
                    checked={ing.optional}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[idx] = { ...ing, optional: e.target.checked };
                      setIngredients(next);
                    }}
                  />
                  Opt
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Steps (one per line)</label>
          <textarea
            className="input min-h-[140px] font-mono text-xs"
            required
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            placeholder={"Heat oil…\nAdd garlic…"}
          />
        </div>
        <div>
          <label className="label">Technique tips (one per line)</label>
          <textarea
            className="input min-h-[72px]"
            value={tipsText}
            onChange={(e) => setTipsText(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Flavor boosters (comma-separated)</label>
          <input
            className="input"
            value={boostersText}
            onChange={(e) => setBoostersText(e.target.value)}
            placeholder="soy sauce, vinegar, chili flakes, lemon"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save recipe"}
        </button>
      </form>
    </div>
  );
}
