/**
 * Pure display helpers for the admin recipe screens.
 * Everything here is deterministic (no locale / timezone / Date.now) so server
 * and client renders match and hydration stays clean.
 */

export type AdminFlagKey =
  | "isStruggleMeal"
  | "kosherEligible"
  | "halalEligible"
  | "veganEligible"
  | "vegetarianEligible"
  | "pescatarianEligible"
  | "carnivoreEligible"
  | "atkinsEligible"
  | "lowCarbEligible"
  | "lowSugarEligible"
  | "lowSodiumEligible";

export type AdminFlagDef = { key: AdminFlagKey; label: string };

export type AdminFlagGroup = {
  id: "program" | "religious" | "diet";
  label: string;
  hint?: string;
  flags: AdminFlagDef[];
};

export const ADMIN_FLAG_GROUPS: AdminFlagGroup[] = [
  {
    id: "program",
    label: "Program",
    flags: [{ key: "isStruggleMeal", label: "Struggle meal" }],
  },
  {
    id: "religious",
    label: "Religious eligibility",
    hint: "* eligible with certified ingredients — not a certification claim",
    flags: [
      { key: "kosherEligible", label: "Kosher*" },
      { key: "halalEligible", label: "Halal*" },
    ],
  },
  {
    id: "diet",
    label: "Diet",
    flags: [
      { key: "veganEligible", label: "Vegan" },
      { key: "vegetarianEligible", label: "Vegetarian" },
      { key: "pescatarianEligible", label: "Pescatarian" },
      { key: "carnivoreEligible", label: "Carnivore" },
      { key: "atkinsEligible", label: "Atkins" },
      { key: "lowCarbEligible", label: "Low carb" },
      { key: "lowSugarEligible", label: "Low sugar" },
      { key: "lowSodiumEligible", label: "Low sodium" },
    ],
  },
];

export const ADMIN_FLAG_KEYS: AdminFlagKey[] = ADMIN_FLAG_GROUPS.flatMap((g) =>
  g.flags.map((f) => f.key)
);

export type AdminFlagValues = Partial<Record<AdminFlagKey, boolean | null>>;

/** Active flags as {group, key, label}, in display order. */
export function activeAdminFlags(
  r: AdminFlagValues
): { group: AdminFlagGroup["id"]; key: AdminFlagKey; label: string }[] {
  const out: { group: AdminFlagGroup["id"]; key: AdminFlagKey; label: string }[] = [];
  for (const g of ADMIN_FLAG_GROUPS) {
    for (const f of g.flags) {
      if (r[f.key]) out.push({ group: g.id, key: f.key, label: f.label });
    }
  }
  return out;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Sep 28, 2026" in UTC — identical on server and client. */
export function formatAdminDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Sep 28, 2026 06:44 UTC" — deterministic timestamp for detail pages. */
export function formatAdminDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatAdminDate(d)} ${hh}:${mm} UTC`;
}

/** 0.5 → "½", 1.25 → "1¼", 2 → "2", 0.333 → "⅓", otherwise 1 decimal. */
export function formatQuantity(q: number | null | undefined): string {
  if (q == null || !Number.isFinite(q)) return "";
  const whole = Math.floor(q);
  const frac = q - whole;
  const fracs: [number, string][] = [
    [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"],
    [2 / 3, "⅔"], [0.75, "¾"],
  ];
  if (frac < 0.01) return String(whole);
  for (const [v, sym] of fracs) {
    if (Math.abs(frac - v) < 0.02) return whole ? `${whole}${sym}` : sym;
  }
  const rounded = Math.round(q * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "2 cup flour", "3 eggs" (unit "each" is dropped). */
export function formatIngredientLine(i: {
  name: string;
  quantity: number;
  unit: string;
}): string {
  const qty = formatQuantity(i.quantity);
  const unit = (i.unit || "").trim();
  const showUnit = unit && unit.toLowerCase() !== "each";
  return [qty, showUnit ? unit : "", i.name].filter(Boolean).join(" ");
}

export function ownerDisplay(
  owner: { name?: string | null; email?: string | null } | null | undefined
): string {
  if (!owner) return "Shared catalog";
  return owner.name?.trim() || owner.email || "Unknown user";
}

export function formatMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ------------------------------------------------------------------ */
/* Adapt notes (kosher / halal / vegan / vegetarian)                   */
/* ------------------------------------------------------------------ */

export type AdaptNoteKey =
  | "kosherAdaptNote"
  | "halalAdaptNote"
  | "veganAdaptNote"
  | "vegetarianAdaptNote";

export const ADAPT_NOTE_FIELDS: { key: AdaptNoteKey; label: string }[] = [
  { key: "kosherAdaptNote", label: "Kosher" },
  { key: "halalAdaptNote", label: "Halal" },
  { key: "veganAdaptNote", label: "Vegan" },
  { key: "vegetarianAdaptNote", label: "Vegetarian" },
];

/** Same limit as the recipe PATCH schemas. */
export const ADAPT_NOTE_MAX = 500;

export type AdaptNoteValues = Partial<Record<AdaptNoteKey, string | null>>;

/** undefined → untouched; null / blank → cleared (null); otherwise trimmed text. */
export function normalizeAdaptNote(
  value: string | null | undefined
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = value.trim();
  return t ? t : null;
}

/** Validation message for one note, or null when OK. */
export function adaptNoteError(value: string | null | undefined): string | null {
  const n = normalizeAdaptNote(value);
  if (n && n.length > ADAPT_NOTE_MAX) {
    return `Keep it under ${ADAPT_NOTE_MAX} characters (${n.length}).`;
  }
  return null;
}

/** Only the notes whose normalized value changed — the body to PATCH. */
export function adaptNotesPatch(
  initial: AdaptNoteValues,
  draft: AdaptNoteValues
): AdaptNoteValues {
  const out: AdaptNoteValues = {};
  for (const { key } of ADAPT_NOTE_FIELDS) {
    if (draft[key] === undefined) continue;
    const next = normalizeAdaptNote(draft[key]) ?? null;
    const prev = normalizeAdaptNote(initial[key] ?? null) ?? null;
    if (next !== prev) out[key] = next;
  }
  return out;
}
