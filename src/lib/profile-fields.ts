/** Pure validators for public profile fields (Stage 1). Client- and server-safe. */
import { isValidProfileSlug } from "@/lib/profile-slug";

export const BIO_MAX = 200;
export const DISPLAY_NAME_MAX = 60;
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/** Handles that would collide with routes, staff roles or the brand. */
export const RESERVED_HANDLES = new Set([
  "admin", "administrator", "api", "account", "accounts", "settings", "edit", "new",
  "me", "u", "cooks", "profile", "profiles", "login", "signin", "signup", "logout",
  "support", "help", "staff", "moderator", "mod", "system", "root", "official",
  "fridgeforge", "fridge-forge", "null", "undefined", "guest", "demo",
]);

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Handle = the existing profileSlug (lowercase letters, numbers, single hyphens). */
export function validateHandle(raw: string): FieldResult<string> {
  const h = raw.trim().replace(/^@/, "").toLowerCase();
  if (h.length < HANDLE_MIN || h.length > HANDLE_MAX) {
    return { ok: false, error: `Handle must be ${HANDLE_MIN}–${HANDLE_MAX} characters.` };
  }
  if (!isValidProfileSlug(h)) {
    return { ok: false, error: "Use lowercase letters, numbers and single hyphens." };
  }
  if (RESERVED_HANDLES.has(h)) return { ok: false, error: "That handle is reserved." };
  return { ok: true, value: h };
}

/** Collapse whitespace, strip control chars; empty → null. */
export function cleanText(raw: string | null | undefined, max: number): FieldResult<string | null> {
  const s = (raw ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!s) return { ok: true, value: null };
  if ([...s].length > max) return { ok: false, error: `Keep it to ${max} characters or fewer.` };
  return { ok: true, value: s };
}

const X_USER = /^[A-Za-z0-9_]{1,15}$/;
const FB_PATH = /^[A-Za-z0-9.\-_/=?]{1,120}$/;

/** Accepts @name, name, x.com/name or twitter.com/name → https://x.com/name. Empty → null. */
export function normalizeXUrl(raw: string | null | undefined): FieldResult<string | null> {
  const s = (raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  let user = s.replace(/^@/, "");
  const m = s.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([^/?#\s]+)\/?(?:[?#].*)?$/i);
  if (m) user = m[1]!;
  else if (/[/:.]/.test(s)) return { ok: false, error: "Enter an X handle or an x.com link." };
  if (!X_USER.test(user)) return { ok: false, error: "That doesn't look like an X handle." };
  return { ok: true, value: `https://x.com/${user}` };
}

/** Accepts facebook.com/… or fb.com/… (http/https, www/m) → https://www.facebook.com/…. Empty → null. */
export function normalizeFacebookUrl(raw: string | null | undefined): FieldResult<string | null> {
  const s = (raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  const m = s.match(/^(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/([^#\s]+?)\/?$/i);
  if (!m || !FB_PATH.test(m[1]!) || /^(?:login|sharer|dialog|plugins)\b/i.test(m[1]!)) {
    return { ok: false, error: "Enter a facebook.com link to your page or profile." };
  }
  return { ok: true, value: `https://www.facebook.com/${m[1]}` };
}

/** True only for URLs this module produced (defence in depth when rendering). */
export function isSafeSocialUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}$/.test(url) ||
    /^https:\/\/www\.facebook\.com\/[A-Za-z0-9.\-_/=?]{1,120}$/.test(url);
}

/** Initials for the avatar placeholder. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? [parts[0]![0], parts[1]![0]] : [...(parts[0] ?? "?")].slice(0, 2);
  return letters.join("").toUpperCase() || "?";
}
