"use client";

export function errText(data: unknown, fallback = "Something went wrong"): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error: unknown }).error;
    if (typeof e === "string") return e;
    const fe = (e as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | null);
    const first = fe && [...(fe.formErrors ?? []), ...Object.values(fe.fieldErrors ?? {}).flat()][0];
    if (first) return first;
  }
  return fallback;
}

export async function jsonFetch<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errText(data));
  return data as T;
}

export async function uploadContentImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/content/images", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.url !== "string") throw new Error(errText(data, "Upload failed"));
  return data.url;
}
