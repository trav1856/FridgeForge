"use client";

import { estimateRecipeNutrition } from "@/lib/recipe-nutrition";
import { RecipeNutritionCard } from "@/components/RecipeNutritionCard";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RecipeImage } from "./RecipeImage";
import {
  RecipePhotoUpload,
  uploadRecipePhotoAfterCreate,
} from "./RecipePhotoUpload";
import {
  COURSES,
  CUISINES,
  FOOD_CATEGORIES,
  MEAT_TYPES,
  ORIGIN_OPTIONS,
  ORIGIN_REGIONS,
  inferRecipeTaxonomy,
  ensureParentCuisineOrigins,
} from "@/lib/recipe-taxonomy";
import { COMMON_ALLERGENS, inferAllergenTags } from "@/lib/allergens";
import { decodeRecipeTextFields } from "@/lib/html-entities";

type Ing = { name: string; quantity: string; unit: string; optional: boolean };

export type RecipeFormDraft = {
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  cookTimeMinutes?: number | null;
  ingredients?: { name: string; quantity: number; unit: string; optional?: boolean }[];
  steps?: string[];
  notes?: string | null;
  costTier?: "cheap" | "moderate";
  tags?: string[];
  cuisine?: string | null;
  course?: string | null;
  foodCategories?: string[];
  origins?: string[];
  meatType?: string | null;
  originStory?: string | null;
  servings?: number;
  isStruggleMeal?: boolean;
  kosherEligible?: boolean;
  halalEligible?: boolean;
  vegetarianEligible?: boolean;
  pescatarianEligible?: boolean;
  veganEligible?: boolean;
  carnivoreEligible?: boolean;
  atkinsEligible?: boolean;
  lowCarbEligible?: boolean;
  lowSugarEligible?: boolean;
  lowSodiumEligible?: boolean;
  kosherAdaptNote?: string | null;
  halalAdaptNote?: string | null;
  veganAdaptNote?: string | null;
  vegetarianAdaptNote?: string | null;
  allergenTags?: string[];
  techniqueTips?: string[];
  flavorBoosters?: string[];
  visibility?: "global" | "household" | "shared" | "public" | "private";
  sourceUrl?: string | null;
};

export type RecipeFormProps = {
  initialDraft?: RecipeFormDraft | null;
  /** Hide the URL / paste import card (used by scan import review). */
  hideUrlImport?: boolean;
  /** Called after a successful create; when set with stayAfterSave, skips navigation. */
  onSaved?: (created: { id: string }) => void;
  stayAfterSave?: boolean;
  mode?: "create" | "edit";
  recipeId?: string;
};

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
    cuisine?: string | null;
    course?: string | null;
    foodCategories?: string[];
    origins?: string[];
    meatType?: string | null;
    tags?: string[];
  },
  setters: {
    setTitle: (v: string) => void;
    setDescription: (v: string) => void;
    setImageUrl: (v: string | null) => void;
    setCookTimeMinutes: (v: string) => void;
    setIngredients: (v: Ing[]) => void;
    setStepsText: (v: string) => void;
    setCuisine?: (v: string) => void;
    setCourse?: (v: string) => void;
    setFoodCategories?: (v: string[]) => void;
    setOrigins?: (v: string[]) => void;
    setMeatType?: (v: string) => void;
  }
) {
  const decoded = decodeRecipeTextFields({
    title: r.title || "",
    description: r.description || "",
    ingredients: r.ingredients || [],
    steps: r.steps || [],
  });
  r = { ...r, ...decoded };
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

  // Fill blank cuisine (and related taxonomy) from inference on import draft apply
  const cuisineBlank = !(r.cuisine || "").trim();
  if (cuisineBlank || !(r.meatType || "").trim()) {
    const inferred = inferRecipeTaxonomy({
      title: r.title || "",
      description: r.description,
      tags: r.tags,
      ingredients: r.ingredients,
      steps: r.steps,
    });
    if (cuisineBlank && setters.setCuisine) {
      setters.setCuisine(inferred.cuisine);
      if (setters.setOrigins) {
        setters.setOrigins(
          ensureParentCuisineOrigins(
            inferred.cuisine,
            r.origins?.length ? r.origins : inferred.origins
          )
        );
      }
      if (setters.setCourse && !(r.course || "").trim()) {
        setters.setCourse(inferred.course);
      }
      if (setters.setFoodCategories && !(r.foodCategories || []).length) {
        setters.setFoodCategories(inferred.foodCategories);
      }
    }
    if (setters.setMeatType && !(r.meatType || "").trim() && inferred.meatType) {
      setters.setMeatType(inferred.meatType);
      if (setters.setFoodCategories) {
        // ensure meat category present
        const cats = new Set(r.foodCategories || []);
        cats.add("meat");
        if (!(r.foodCategories || []).length && cuisineBlank) {
          for (const c of inferred.foodCategories) cats.add(c);
        }
        setters.setFoodCategories([...cats]);
      }
    }
  } else {
    if (r.cuisine && setters.setCuisine) setters.setCuisine(r.cuisine);
    if (r.course && setters.setCourse) setters.setCourse(r.course);
    if (r.foodCategories && setters.setFoodCategories)
      setters.setFoodCategories(r.foodCategories);
    if (r.origins && setters.setOrigins) setters.setOrigins(r.origins);
    if (r.meatType && setters.setMeatType) setters.setMeatType(r.meatType);
  }
}

function draftToIngredients(d?: RecipeFormDraft | null): Ing[] {
  const list = d?.ingredients || [];
  if (!list.length) return [blankIng()];
  return list.map((i) => ({
    name: i.name,
    quantity: String(i.quantity ?? 1),
    unit: i.unit || "each",
    optional: Boolean(i.optional),
  }));
}

export function RecipeForm({
  initialDraft = null,
  hideUrlImport = false,
  onSaved,
  stayAfterSave = false,
  mode = "create",
  recipeId,
}: RecipeFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit" && Boolean(recipeId);
  const [title, setTitle] = useState(initialDraft?.title || "");
  const [description, setDescription] = useState(
    initialDraft?.description || initialDraft?.notes || ""
  );
  const [costTier, setCostTier] = useState<"cheap" | "moderate">(
    initialDraft?.costTier === "moderate" ? "moderate" : "cheap"
  );
  const [visibility, setVisibility] = useState<"global" | "household" | "shared">(
    initialDraft?.visibility === "global" ||
      initialDraft?.visibility === "public"
      ? "global"
      : initialDraft?.visibility === "shared"
        ? "shared"
        : "household"
  );
  const [tags, setTags] = useState((initialDraft?.tags || []).join(", "));
  const [cuisine, setCuisine] = useState(initialDraft?.cuisine || "");
  const [course, setCourse] = useState(initialDraft?.course || "");
  const [foodCategories, setFoodCategories] = useState<string[]>(
    initialDraft?.foodCategories || []
  );
  const [origins, setOrigins] = useState<string[]>(initialDraft?.origins || []);
  const [originStory, setOriginStory] = useState(
    initialDraft?.originStory || ""
  );
  const [servings, setServings] = useState(
    initialDraft?.servings != null ? String(initialDraft.servings) : "2"
  );
  const [cookTimeMinutes, setCookTimeMinutes] = useState(
    initialDraft?.cookTimeMinutes != null && initialDraft.cookTimeMinutes > 0
      ? String(initialDraft.cookTimeMinutes)
      : ""
  );
  const [isStruggleMeal, setIsStruggleMeal] = useState(
    initialDraft?.isStruggleMeal ?? true
  );
  const [kosherEligible, setKosherEligible] = useState(
    initialDraft?.kosherEligible ?? true
  );
  const [halalEligible, setHalalEligible] = useState(
    initialDraft?.halalEligible ?? true
  );
  const [vegetarianEligible, setVegetarianEligible] = useState(
    initialDraft?.vegetarianEligible ?? true
  );
  const [pescatarianEligible, setPescatarianEligible] = useState(
    initialDraft?.pescatarianEligible ?? true
  );
  const [veganEligible, setVeganEligible] = useState(
    initialDraft?.veganEligible ?? false
  );
  const [carnivoreEligible, setCarnivoreEligible] = useState(
    initialDraft?.carnivoreEligible ?? false
  );
  const [atkinsEligible, setAtkinsEligible] = useState(
    initialDraft?.atkinsEligible ?? false
  );
  const [lowCarbEligible, setLowCarbEligible] = useState(
    initialDraft?.lowCarbEligible ?? false
  );
  const [lowSugarEligible, setLowSugarEligible] = useState(
    initialDraft?.lowSugarEligible ?? false
  );
  const [lowSodiumEligible, setLowSodiumEligible] = useState(
    initialDraft?.lowSodiumEligible ?? false
  );
  const [kosherAdaptNote, setKosherAdaptNote] = useState(
    initialDraft?.kosherAdaptNote || ""
  );
  const [halalAdaptNote, setHalalAdaptNote] = useState(
    initialDraft?.halalAdaptNote || ""
  );
  const [veganAdaptNote, setVeganAdaptNote] = useState(
    initialDraft?.veganAdaptNote || ""
  );
  const [vegetarianAdaptNote, setVegetarianAdaptNote] = useState(
    initialDraft?.vegetarianAdaptNote || ""
  );
  const [allergenTags, setAllergenTags] = useState<string[]>(
    initialDraft?.allergenTags || []
  );
  const [stepsText, setStepsText] = useState(
    (initialDraft?.steps || []).join("\n")
  );
  const [tipsText, setTipsText] = useState(
    (initialDraft?.techniqueTips || []).join("\n")
  );
  const [boostersText, setBoostersText] = useState(
    (initialDraft?.flavorBoosters || []).join(", ")
  );
  const [ingredients, setIngredients] = useState<Ing[]>(
    draftToIngredients(initialDraft)
  );
  const [importUrl, setImportUrl] = useState(initialDraft?.sourceUrl || "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    initialDraft?.imageUrl || null
  );
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
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
    setCuisine,
    setCourse,
    setFoodCategories,
    setOrigins,
    setMeatType,
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
      visibility,
      cuisine: cuisine || null,
      course: course || null,
      foodCategories,
      meatType: foodCategories.includes("meat") ? meatType || null : null,
      origins,
      originStory: originStory.trim() || null,
      servings: Number(servings) || 2,
      cookTimeMinutes: cookTimeMinutes.trim()
        ? Number(cookTimeMinutes) || null
        : null,
      isStruggleMeal,
      kosherEligible,
      halalEligible,
      vegetarianEligible,
      pescatarianEligible,
      veganEligible,
      carnivoreEligible,
      atkinsEligible,
      lowCarbEligible,
      lowSugarEligible,
      lowSodiumEligible,
      kosherAdaptNote: kosherAdaptNote.trim() || null,
      halalAdaptNote: halalAdaptNote.trim() || null,
      veganAdaptNote: veganAdaptNote.trim() || null,
      vegetarianAdaptNote: vegetarianAdaptNote.trim() || null,
      allergenTags,
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
      const url = isEdit ? `/api/recipes/${recipeId}` : "/api/recipes";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ? JSON.stringify(data.error) : "Save failed");
      }
      const saved = await res.json();
      if (pendingPhoto) {
        const up = await uploadRecipePhotoAfterCreate(saved.id, pendingPhoto);
        if (!up.ok) {
          setError(
            `Recipe saved, but photo failed: ${up.error}. You can add a photo on the recipe page.`
          );
          setSaving(false);
          onSaved?.({ id: saved.id });
          if (!stayAfterSave) {
            router.push(`/recipes/${saved.id}`);
          }
          return;
        }
      }
      onSaved?.({ id: saved.id });
      if (!stayAfterSave) {
        router.push(`/recipes/${saved.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recipe");
    } finally {
      setSaving(false);
    }
  }

  const nutritionPreview = estimateRecipeNutrition(
    ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: Number(i.quantity) || 0,
        unit: i.unit || "each",
      })),
    Number(servings) || 2
  );

  return (
    <div className="space-y-6">
      {!hideUrlImport && !isEdit && (
      <div className="card space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-sage-900">
            Import from URL
          </h2>
          <Link href="/recipes/import" className="btn-ghost text-sm">
            Scan a page
          </Link>
        </div>
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
        {imageUrl && !pendingPhoto && (
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
      )}

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
        <RecipePhotoUpload
          imageUrl={imageUrl}
          alt={title || "Recipe photo"}
          pendingFile={pendingPhoto}
          onPendingFileChange={(file) => {
            setPendingPhoto(file);
            if (file) {
              // Prefer user photo over imported scrape URL on save
              setImageUrl(null);
            }
          }}
          onImageUrlChange={setImageUrl}
        />
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
            <label className="label">Visibility</label>
            <select
              className="input"
              value={visibility}
              onChange={(e) =>
                setVisibility(
                  e.target.value as "global" | "household" | "shared"
                )
              }
            >
              <option value="global">Global (anyone)</option>
              <option value="household">Household only</option>
              <option value="shared">Shared (specific people)</option>
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
          <div className="flex flex-wrap items-end gap-4 pb-1">
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={isStruggleMeal}
                onChange={(e) => setIsStruggleMeal(e.target.checked)}
              />
              Struggle meal
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={kosherEligible}
                onChange={(e) => setKosherEligible(e.target.checked)}
              />
              Kosher* eligible
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={halalEligible}
                onChange={(e) => setHalalEligible(e.target.checked)}
              />
              Halal* eligible
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={veganEligible}
                onChange={(e) => setVeganEligible(e.target.checked)}
              />
              Vegan
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={vegetarianEligible}
                onChange={(e) => setVegetarianEligible(e.target.checked)}
              />
              Vegetarian
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={pescatarianEligible}
                onChange={(e) => setPescatarianEligible(e.target.checked)}
              />
              Pescatarian
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={carnivoreEligible}
                onChange={(e) => setCarnivoreEligible(e.target.checked)}
              />
              Carnivore
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={atkinsEligible}
                onChange={(e) => setAtkinsEligible(e.target.checked)}
              />
              Atkins
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={lowCarbEligible}
                onChange={(e) => setLowCarbEligible(e.target.checked)}
              />
              Low carb
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={lowSugarEligible}
                onChange={(e) => setLowSugarEligible(e.target.checked)}
              />
              Low sugar
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
              <input
                type="checkbox"
                checked={lowSodiumEligible}
                onChange={(e) => setLowSodiumEligible(e.target.checked)}
              />
              Low sodium
            </label>
          </div>
          <p className="text-[10px] text-sage-500 sm:col-span-2">
            * Eligible if prepared with certified kosher/halal ingredients — not a
            certification claim.
          </p>
          <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">Kosher adapt note</label>
              <input
                className="input"
                value={kosherAdaptNote}
                onChange={(e) => setKosherAdaptNote(e.target.value)}
                placeholder="e.g. Swap shrimp for kosher fish"
                maxLength={500}
              />
            </div>
            <div>
              <label className="label">Halal adapt note</label>
              <input
                className="input"
                value={halalAdaptNote}
                onChange={(e) => setHalalAdaptNote(e.target.value)}
                placeholder="e.g. Omit wine; use stock"
                maxLength={500}
              />
            </div>
            <div>
              <label className="label">Vegan adapt note</label>
              <input
                className="input"
                value={veganAdaptNote}
                onChange={(e) => setVeganAdaptNote(e.target.value)}
                placeholder="e.g. Swap butter for plant margarine"
                maxLength={500}
              />
            </div>
            <div>
              <label className="label">Vegetarian adapt note</label>
              <input
                className="input"
                value={vegetarianAdaptNote}
                onChange={(e) => setVegetarianAdaptNote(e.target.value)}
                placeholder="e.g. Replace chicken with chickpeas"
                maxLength={500}
              />
            </div>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="label mb-0">Allergen tags</label>
            <button
              type="button"
              className="text-xs font-semibold text-ember-700 hover:underline"
              onClick={() => {
                const inferred = inferAllergenTags({
                  title,
                  description,
                  tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
                  ingredients: ingredients.map((i) => ({ name: i.name })),
                  steps: stepsText.split("\n"),
                });
                setAllergenTags((prev) =>
                  [...new Set([...prev, ...inferred])]
                );
              }}
            >
              Infer from ingredients
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {COMMON_ALLERGENS.map((a) => {
              const on = allergenTags.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    on
                      ? "bg-sage-800 text-cream-50"
                      : "border border-cream-300 bg-cream-100 text-sage-800"
                  }`}
                  aria-pressed={on}
                  onClick={() =>
                    setAllergenTags((prev) =>
                      on ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                    )
                  }
                >
                  {a.label}
                </button>
              );
            })}
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Cuisine</label>
            <select
              className="input"
              value={cuisine}
              onChange={(e) => {
                const next = e.target.value;
                setCuisine(next);
                if (next) {
                  setOrigins((prev) => ensureParentCuisineOrigins(next, prev));
                }
              }}
            >
              <option value="">—</option>
              {CUISINES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Course</label>
            <select
              className="input"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              <option value="">—</option>
              {COURSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Food categories</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {FOOD_CATEGORIES.map((c) => {
              const on = foodCategories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    on
                      ? "bg-sage-800 text-cream-50"
                      : "border border-cream-300 bg-cream-100 text-sage-800"
                  }`}
                  onClick={() => {
                    setFoodCategories((prev) => {
                      const next = on
                        ? prev.filter((x) => x !== c)
                        : [...prev, c];
                      if (c === "meat" && on) setMeatType("");
                      return next;
                    });
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
          {(foodCategories.includes("meat") || Boolean(meatType)) && (
            <div className="mt-2" data-testid="meat-type-selector">
              <label className="label">Meat type</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {MEAT_TYPES.map((m) => {
                  const on = meatType === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        on
                          ? "bg-ember-600 text-white"
                          : "border border-cream-300 bg-cream-100 text-sage-800"
                      }`}
                      onClick={() => {
                        setMeatType(on ? "" : m);
                        if (!on && !foodCategories.includes("meat")) {
                          setFoodCategories((prev) => [...prev, "meat"]);
                        }
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-sage-500">
                Fish and shrimp stay under seafood, not meat.
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="label">Origin (by region)</label>
          <div className="mt-1 max-h-44 space-y-2 overflow-y-auto">
            {ORIGIN_REGIONS.map((region) => (
              <div key={region.id}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
                  {region.label}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ORIGIN_OPTIONS.filter((o) => o.regionId === region.id).map(
                    (o) => {
                      const on = origins.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            on
                              ? "bg-sage-800 text-cream-50"
                              : "border border-cream-300 bg-cream-100 text-sage-800"
                          }`}
                          onClick={() =>
                            setOrigins((prev) =>
                              on
                                ? prev.filter((x) => x !== o.id)
                                : [...prev, o.id]
                            )
                          }
                        >
                          {o.depth ? "· ".repeat(o.depth) : ""}
                          {o.label}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Story behind this food (optional)</label>
          <textarea
            className="input min-h-[100px]"
            value={originStory}
            onChange={(e) => setOriginStory(e.target.value)}
            placeholder="Short cultural or history note shown on the recipe page…"
          />
          <p className="mt-1 text-xs text-sage-500">
            Appears under Learn more on the recipe detail page. Leave blank to hide.
          </p>
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
        {nutritionPreview.matchedCount > 0 && (
          <div id="recipe-nutrition-preview" className="pt-2">
            <RecipeNutritionCard estimate={nutritionPreview} />
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Update recipe" : "Save recipe"}
        </button>
      </form>
    </div>
  );
}
