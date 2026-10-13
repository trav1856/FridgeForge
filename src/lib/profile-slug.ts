/** Public profile slug helpers (pure + allocation). */
import { randomBytes } from "crypto";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normalize a free-form string into a URL-safe slug base. */
export function slugifyProfileBase(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return s.slice(0, 48);
}

/** Default base from email local-part, falling back to display name. */
export function defaultProfileSlugBase(
  email: string,
  name?: string | null
): string {
  const local = (email.split("@")[0] ?? "").trim();
  const fromEmail = slugifyProfileBase(local);
  if (fromEmail.length >= 2) return fromEmail;
  const fromName = slugifyProfileBase(name ?? "");
  if (fromName.length >= 2) return fromName;
  return "cook";
}

export function isValidProfileSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 48 && SLUG_RE.test(slug);
}

/** Append -2, -3, … until `taken` returns false. */
export function uniquifySlug(
  base: string,
  taken: (candidate: string) => boolean
): string {
  const root = isValidProfileSlug(base) ? base : "cook";
  if (!taken(root)) return root;
  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`;
    const trimmed = root.slice(0, Math.max(1, 48 - suffix.length));
    const candidate = `${trimmed}${suffix}`;
    if (!taken(candidate)) return candidate;
  }
  return `${root.slice(0, 40)}-${Date.now().toString(36)}`;
}

/* ----------------- neutral handles (never derived from email) ----------------- */

const RANDOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i

/** `cook-` + 6 random lowercase letters/digits, e.g. cook-7k3f9q. */
export function randomHandle(rand: (n: number) => Buffer = randomBytes): string {
  const bytes = rand(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += RANDOM_ALPHABET[bytes[i]! % RANDOM_ALPHABET.length];
  return `cook-${s}`;
}

/** Pick a random handle not in use (async `taken` check); falls back to a longer suffix. */
export async function allocateRandomHandle(
  taken: (candidate: string) => Promise<boolean>,
  rand: (n: number) => Buffer = randomBytes
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const c = randomHandle(rand);
    if (!(await taken(c))) return c;
  }
  const c = `cook-${randomBytes(8).toString("hex")}`;
  return c;
}

/**
 * "Never customized" rule: the slug is exactly what the old allocator would
 * have produced from this email (or the name fallback it used when the email
 * local part was too short), i.e. the base itself, the base with a `-N`
 * collision suffix (base trimmed to fit 48 chars), or the rare
 * `{base[0..40]}-{base36 timestamp}` fallback. Users who picked their own
 * handle in Edit profile won't match unless they typed exactly that.
 */
export function isAutoSlugFromEmail(
  slug: string | null | undefined,
  email: string,
  name?: string | null
): boolean {
  if (!slug) return false;
  const local = (email.split("@")[0] ?? "").trim();
  const bases = new Set<string>();
  const fromEmail = slugifyProfileBase(local);
  if (fromEmail.length >= 2) bases.add(fromEmail);
  // Variant without a "+tag", in case of older allocations.
  const noTag = slugifyProfileBase(local.split("+")[0] ?? "");
  if (noTag.length >= 2) bases.add(noTag);
  const def = defaultProfileSlugBase(email, name);
  if (def !== "cook") bases.add(def);
  for (const base of bases) {
    const root = isValidProfileSlug(base) ? base : null;
    if (!root) continue;
    if (slug === root) return true;
    const m = slug.match(/^(.*)-(\d{1,4})$/);
    if (m && Number(m[2]) >= 2) {
      const suffix = `-${m[2]}`;
      if (m[1] === root.slice(0, Math.max(1, 48 - suffix.length))) return true;
    }
    const t = slug.match(/^(.*)-([0-9a-z]{6,12})$/);
    if (t && t[1] === root.slice(0, 40) && /^[0-9a-z]+$/.test(t[2]!) && root.length > 40) return true;
  }
  return false;
}
