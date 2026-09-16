import { parseIngredientLine, parseRecipeFromText } from "@/lib/scrape-recipe";

export type RecipeImportDraft = {
  title: string;
  description?: string | null;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[];
  cookTimeMinutes?: number | null;
  notes?: string | null;
};

export type StructureResult = {
  draft: RecipeImportDraft;
  source: "ollama" | "heuristic";
  model?: string;
};

const DRAFT_SCHEMA_HINT = `{
  "title": string,
  "description": string|null,
  "ingredients": [{"name": string, "quantity": number, "unit": string}],
  "steps": string[],
  "cookTimeMinutes": number|null,
  "notes": string|null
}`;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function asPositiveNumber(v: unknown, fallback = 1): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d./-]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

/** Parse / coerce LLM JSON into a RecipeImportDraft. Pure — safe for unit tests. */
export function parseDraftJson(raw: unknown): RecipeImportDraft | null {
  let data: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      // Strip markdown fences if the model ignored format:json
      const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      data = JSON.parse(fence ? fence[1] : trimmed);
    } catch {
      return null;
    }
  }
  if (!isRecord(data)) return null;

  const title = asString(data.title) || asString(data.name);
  const ingredientsRaw = data.ingredients;
  const stepsRaw = data.steps ?? data.directions ?? data.instructions;

  const ingredients: RecipeImportDraft["ingredients"] = [];
  if (Array.isArray(ingredientsRaw)) {
    for (const row of ingredientsRaw) {
      if (typeof row === "string") {
        const parsed = parseIngredientLine(row);
        if (parsed.name) ingredients.push(parsed);
        continue;
      }
      if (!isRecord(row)) continue;
      const name = asString(row.name) || asString(row.ingredient);
      if (!name) continue;
      ingredients.push({
        name,
        quantity: asPositiveNumber(row.quantity ?? row.qty, 1),
        unit: asString(row.unit, "each") || "each",
      });
    }
  }

  const steps: string[] = [];
  if (Array.isArray(stepsRaw)) {
    for (const s of stepsRaw) {
      if (typeof s === "string" && s.trim()) {
        steps.push(s.replace(/^\d+[.)]\s*/, "").trim());
      } else if (isRecord(s)) {
        const t = asString(s.text) || asString(s.step);
        if (t) steps.push(t);
      }
    }
  } else if (typeof stepsRaw === "string" && stepsRaw.trim()) {
    for (const line of stepsRaw.split(/\n+/)) {
      const t = line.replace(/^\d+[.)]\s*/, "").trim();
      if (t) steps.push(t);
    }
  }

  if (!title || ingredients.length < 1 || steps.length < 1) return null;

  let cookTimeMinutes: number | null = null;
  if (data.cookTimeMinutes != null) {
    const n = asPositiveNumber(data.cookTimeMinutes, 0);
    cookTimeMinutes = n > 0 ? Math.round(n) : null;
  }

  const description = asString(data.description) || null;
  const notes = asString(data.notes) || null;

  return {
    title: title.slice(0, 200),
    description: description ? description.slice(0, 2000) : null,
    ingredients,
    steps,
    cookTimeMinutes,
    notes: notes ? notes.slice(0, 2000) : null,
  };
}

/** Heuristic fallback using existing paste parser. */
export function structureRecipeHeuristic(rawText: string): StructureResult | null {
  const result = parseRecipeFromText(rawText);
  if (!result.ok) {
    // Loosen: try to salvage a minimal draft if we at least have lines
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 3) return null;
    const title = lines[0].length < 120 ? lines[0] : "Imported recipe";
    const rest = lines[0] === title ? lines.slice(1) : lines;
    const mid = Math.max(1, Math.floor(rest.length / 2));
    const ingLines = rest.slice(0, mid).filter((l) => l.length < 120);
    const stepLines = rest.slice(mid).map((l) => l.replace(/^\d+[.)]\s*/, "").trim());
    if (ingLines.length < 1 || stepLines.length < 1) return null;
    return {
      source: "heuristic",
      draft: {
        title,
        ingredients: ingLines.map(parseIngredientLine),
        steps: stepLines,
        notes: null,
      },
    };
  }
  return {
    source: "heuristic",
    draft: {
      title: result.recipe.title,
      description: result.recipe.description ?? null,
      ingredients: result.recipe.ingredients,
      steps: result.recipe.steps,
      cookTimeMinutes: result.recipe.cookTimeMinutes ?? null,
      notes: null,
    },
  };
}

export function defaultOllamaHost(): string {
  return (
    process.env.OLLAMA_HOST ||
    process.env.RECIPE_IMPORT_OLLAMA_HOST ||
    "http://gordy.local:11434"
  );
}

/** Prefer Nemotron for structured JSON, else Gemma, else env / first tag. */
export function pickOllamaModel(
  modelNames: string[],
  preferredEnv?: string | null
): string | null {
  if (!modelNames.length) return preferredEnv || null;
  const envPref = preferredEnv || process.env.OLLAMA_MODEL || null;
  if (envPref && modelNames.some((n) => n === envPref || n.startsWith(`${envPref}:`))) {
    return modelNames.find((n) => n === envPref || n.startsWith(`${envPref}:`)) || envPref;
  }
  const nemo = modelNames.find((n) => /nemotron/i.test(n));
  if (nemo) return nemo;
  const gemma = modelNames.find((n) => /gemma/i.test(n));
  if (gemma) return gemma;
  if (envPref) return envPref;
  return modelNames[0] || null;
}

export async function listOllamaModels(
  host: string,
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  try {
    const base = host.replace(/\/$/, "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetchImpl(`${base}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name?: string }[] };
    return (data.models || [])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
  } catch {
    return [];
  }
}

export async function structureRecipeWithOllama(
  rawText: string,
  options?: {
    host?: string;
    model?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<StructureResult | null> {
  const host = (options?.host || defaultOllamaHost()).replace(/\/$/, "");
  const fetchImpl = options?.fetchImpl || fetch;
  const names = await listOllamaModels(host, fetchImpl);
  const model = options?.model || pickOllamaModel(names);
  if (!model) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45_000);
    const res = await fetchImpl(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        prompt: `You convert OCR text from a cookbook page crop into a single recipe draft.
Return JSON only matching this schema:
${DRAFT_SCHEMA_HINT}
Rules:
- One recipe only from the text.
- quantity must be a positive number (use fractions as decimals, e.g. 0.5).
- unit like cup, tbsp, tsp, oz, lb, each, clove, etc.
- steps are cooking instructions, one string per step, no leading numbers.
- If a field is unknown use null or omit.
OCR text:
---
${rawText.slice(0, 12_000)}
---`,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    const draft = parseDraftJson(data.response || "");
    if (!draft) return null;
    return { draft, source: "ollama", model };
  } catch {
    return null;
  }
}

/** Ollama first, then heuristic. Always returns a draft or null. */
export async function structureRecipeDraft(
  rawText: string,
  options?: {
    host?: string;
    model?: string;
    tryOllama?: boolean;
    fetchImpl?: typeof fetch;
  }
): Promise<StructureResult | null> {
  if (!rawText.trim()) return null;
  if (options?.tryOllama !== false) {
    const ollama = await structureRecipeWithOllama(rawText, options);
    if (ollama) return ollama;
  }
  return structureRecipeHeuristic(rawText);
}
