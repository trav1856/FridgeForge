/** Public profile slug helpers (pure + allocation). */

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
