import { ForbiddenError } from "@/lib/admin";

type HeaderSource = { headers: { get(name: string): string | null } };

/**
 * CSRF guard for cookie-authenticated mutations.
 * - Browsers send Sec-Fetch-Site on every fetch; only "same-origin" is accepted.
 * - Otherwise, when an Origin header is present its host must match Host or
 *   X-Forwarded-Host (works behind the Tailscale proxy and on LAN/localhost).
 * - Requests with neither header are non-browser clients and cannot ride a
 *   victim's cookies cross-site, so they pass (auth is still required).
 */
export function isSameOriginRequest(req: HeaderSource): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const hosts = [req.headers.get("host"), req.headers.get("x-forwarded-host")]
    .flatMap((h) => (h ? h.split(",") : []))
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return hosts.includes(originHost);
}

export function assertSameOrigin(req: HeaderSource): void {
  if (!isSameOriginRequest(req)) {
    throw new ForbiddenError("Cross-site request blocked");
  }
}

/** Public base URL for links shown to the admin (uses the origin they are browsing on). */
export function requestBaseUrl(req: HeaderSource & { nextUrl?: { origin: string } }): string {
  const origin = req.headers.get("origin");
  if (origin && /^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host.split(",")[0]!.trim()}`;
  }
  return req.nextUrl?.origin ?? "";
}
