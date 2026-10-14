import * as cheerio from "cheerio";
import { parseYoutubeVideoId, youtubeEmbedUrl } from "@/lib/origin-story-media";

/**
 * Allowlist HTML sanitizer for Kitchen Table posts. Runs on every save (server)
 * so stored HTML is always clean; rendering trusts only stored, sanitized HTML.
 * - Unknown tags are unwrapped (text kept); script/style/etc. are dropped whole.
 * - Every attribute not listed is removed (no on*, style, class, id, srcset...).
 * - Links: http(s), mailto or site-relative only; forced rel/target.
 * - Images: only our own processed /content-images/*.webp files.
 * - Video: only YouTube, rewritten to a fixed youtube-nocookie iframe.
 */
export const CONTENT_IMAGE_RE = /^\/content-images\/[A-Za-z0-9._-]+\.webp$/;
const ALLOWED = new Set([
  "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "blockquote",
  "ul", "ol", "li", "a", "img", "figure", "figcaption", "hr", "code", "pre",
]);
const DROP = new Set([
  "script", "style", "noscript", "template", "object", "embed", "form", "input",
  "button", "textarea", "select", "svg", "math", "link", "meta", "base", "head", "title", "frame", "frameset",
]);
export const MAX_BODY_CHARS = 200_000;

function safeHref(href: string | undefined): string | null {
  const h = (href || "").trim();
  if (!h) return null;
  if (/^\/(?!\/)/.test(h)) return h;
  if (/^#[A-Za-z0-9_-]*$/.test(h)) return h;
  try {
    const u = new URL(h);
    if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") return u.toString();
  } catch {
    /* invalid */
  }
  return null;
}

export function youtubeIframeHtml(videoId: string): string {
  return `<div class="ff-embed" data-youtube="${videoId}"><iframe src="${youtubeEmbedUrl(videoId)}" title="YouTube video" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
}

export function sanitizePostHtml(input: string | null | undefined): string {
  const raw = String(input ?? "").slice(0, MAX_BODY_CHARS);
  if (!raw.trim()) return "";
  const $ = cheerio.load(raw, null, false);
  // Comments / processing instructions.
  $("*").contents().filter((_, n) => n.type === "comment" || n.type === "directive").remove();
  $.root().contents().filter((_, n) => n.type === "comment" || n.type === "directive").remove();

  // YouTube embeds first: iframe or our placeholder div -> canonical markup token.
  const tokens: string[] = [];
  $("iframe, div[data-youtube]").each((_, el) => {
    const $el = $(el);
    const id = parseYoutubeVideoId($el.attr("data-youtube") || $el.attr("src") || "");
    if (!id) { $el.remove(); return; }
    tokens.push(id);
    $el.replaceWith(`<ffyt data-i="${tokens.length - 1}"></ffyt>`);
  });

  // Walk deepest-first so unwrapping doesn't skip children.
  const all = $("*").toArray().reverse();
  for (const el of all) {
    // domhandler types <script>/<style> as "script"/"style", not "tag": handle all element kinds.
    if (el.type !== "tag" && el.type !== "script" && el.type !== "style") continue;
    const tag = el.tagName.toLowerCase();
    const $el = $(el);
    if (tag === "ffyt") continue;
    if (DROP.has(tag)) { $el.remove(); continue; }
    if (!ALLOWED.has(tag)) { $el.replaceWith($el.contents()); continue; }
    const attrs = { ...(el.attribs || {}) };
    for (const a of Object.keys(attrs)) $el.removeAttr(a);
    if (tag === "a") {
      const href = safeHref(attrs.href);
      if (!href) { $el.replaceWith($el.contents()); continue; }
      $el.attr("href", href);
      if (!href.startsWith("/") && !href.startsWith("#")) {
        $el.attr("rel", "noopener nofollow ugc");
        $el.attr("target", "_blank");
      }
    } else if (tag === "img") {
      const src = (attrs.src || "").trim();
      if (!CONTENT_IMAGE_RE.test(src)) { $el.remove(); continue; }
      $el.attr("src", src);
      $el.attr("alt", (attrs.alt || "").slice(0, 300));
      $el.attr("loading", "lazy");
    }
  }
  let html = $.html();
  html = html.replace(/<ffyt data-i="(\d+)"><\/ffyt>/g, (_m, i) => youtubeIframeHtml(tokens[Number(i)]!));
  return html.trim();
}

/** Managed image files a body references (for export + cleanup). */
export function contentImagesInHtml(html: string | null | undefined): string[] {
  const out = new Set<string>();
  for (const m of String(html ?? "").matchAll(/\/content-images\/[A-Za-z0-9._-]+\.webp/g)) out.add(m[0]);
  return [...out];
}

/** Plain-text excerpt from sanitized HTML. */
export function htmlToText(html: string, max = 220): string {
  const text = cheerio.load(html || "", null, false).text().replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
