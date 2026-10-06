/** Server-side display helpers for admin pages (render on the server only to avoid hydration drift). */

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtRelative(d: Date | null | undefined, now: Date = new Date()): string {
  if (!d) return "Never";
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.round(h / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return fmtDate(d);
}

export function initials(name: string | null | undefined, email: string): string {
  const src = (name || "").trim();
  if (src) {
    const parts = src.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
  }
  return (email[0] ?? "?").toUpperCase();
}

const AVATAR_TONES = [
  "bg-ember-100 text-ember-800",
  "bg-sage-100 text-sage-800",
  "bg-cream-200 text-sage-700",
  "bg-ember-200 text-ember-900",
];

export function avatarTone(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}
