/**
 * Safe origin-story rendering: escape HTML, autolink http(s),
 * markdown links, and extract YouTube embeds (privacy-enhanced).
 */

export type YoutubeEmbed = {
  id: string;
  embedUrl: string;
  watchUrl: string;
};

const YT_ID_RE =
  /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;

export function extractYoutubeId(url: string): string | null {
  try {
    const m = url.match(YT_ID_RE);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export function extractYoutubeEmbeds(text: string): YoutubeEmbed[] {
  const seen = new Set<string>();
  const out: YoutubeEmbed[] = [];
  const urlRe = /https?:\/\/[^\s<>"')\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text || ""))) {
    let url = m[0].replace(/[.,;:!?)]+$/, "");
    const id = extractYoutubeId(url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
    });
  }
  const mdRe = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
  while ((m = mdRe.exec(text || ""))) {
    const id = extractYoutubeId(m[1]!);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
    });
  }
  return out;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Escape text, turn markdown links and bare http(s) URLs into anchors
 * (target=_blank rel=noopener noreferrer).
 */
export function renderOriginStoryHtml(text: string): string {
  const src = text || "";
  const paras = src.split(/\n\n+/);
  return paras
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      return `<p>${linkifyEscaped(trimmed).replace(/\n/g, "<br/>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function linkifyEscaped(para: string): string {
  type Part =
    | { kind: "text"; value: string }
    | { kind: "md"; label: string; href: string };

  const parts: Part[] = [];
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(para))) {
    if (m.index > last) {
      parts.push({ kind: "text", value: para.slice(last, m.index) });
    }
    parts.push({ kind: "md", label: m[1]!, href: m[2]! });
    last = m.index + m[0].length;
  }
  if (last < para.length) {
    parts.push({ kind: "text", value: para.slice(last) });
  }
  if (parts.length === 0) parts.push({ kind: "text", value: para });

  return parts
    .map((p) => {
      if (p.kind === "md") {
        if (!isSafeHttpUrl(p.href)) {
          return escapeHtml(`[${p.label}](${p.href})`);
        }
        return `<a href="${escapeHtml(p.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.label)}</a>`;
      }
      return autolinkText(p.value);
    })
    .join("");
}

function autolinkText(text: string): string {
  const urlRe = /https?:\/\/[^\s<>"')\]]+/gi;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text))) {
    out += escapeHtml(text.slice(last, m.index));
    let url = m[0];
    let trail = "";
    const trailMatch = url.match(/[.,;:!?)]+$/);
    if (trailMatch) {
      trail = trailMatch[0];
      url = url.slice(0, -trail.length);
    }
    if (isSafeHttpUrl(url)) {
      out += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
      out += escapeHtml(trail);
    } else {
      out += escapeHtml(m[0]);
    }
    last = m.index + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}
