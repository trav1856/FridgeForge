import { randomBytes } from "crypto";

export class ContentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ContentError";
    this.status = status;
  }
}

export function slugify(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

export async function uniqueSlug(base: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base);
  if (!(await taken(root))) return root;
  for (let i = 0; i < 6; i++) {
    const s = `${root}-${randomBytes(2).toString("hex")}`;
    if (!(await taken(s))) return s;
  }
  return `${root}-${randomBytes(6).toString("hex")}`;
}

export function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export function cleanStringList(input: unknown, maxItems: number, maxLen: number): string[] {
  const arr = Array.isArray(input) ? input : [];
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") continue;
    const t = v.replace(/\s+/g, " ").trim().slice(0, maxLen);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

export type ProfileLink = { label: string; url: string };

/** http(s) only, normalized; label defaults to host. */
export function normalizeLink(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function cleanLinks(input: unknown): ProfileLink[] {
  const arr = Array.isArray(input) ? input : [];
  const out: ProfileLink[] = [];
  for (const v of arr) {
    if (!v || typeof v !== "object") continue;
    const url = normalizeLink(String((v as { url?: unknown }).url ?? ""));
    if (!url) continue;
    const label = String((v as { label?: unknown }).label ?? "").trim().slice(0, 60) || new URL(url).hostname.replace(/^www\./, "");
    out.push({ label, url });
    if (out.length >= 8) break;
  }
  return out;
}

const YT_CHANNEL_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
/** A YouTube channel/profile URL (https://www.youtube.com/@name, /channel/, /c/, /user/). */
export function normalizeYoutubeChannel(input: string | null | undefined): string | null {
  const url = normalizeLink(input || "");
  if (!url) return null;
  const u = new URL(url);
  if (!YT_CHANNEL_HOSTS.has(u.hostname.toLowerCase())) return null;
  if (!/^\/(@[A-Za-z0-9._-]+|channel\/[A-Za-z0-9_-]+|c\/[A-Za-z0-9._-]+|user\/[A-Za-z0-9._-]+)\/?$/.test(u.pathname)) return null;
  return `https://www.youtube.com${u.pathname.replace(/\/$/, "")}`;
}
