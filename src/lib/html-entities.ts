/** Decode common HTML entities in imported / pasted recipe text. */
export function decodeHtmlEntities(input: string): string {
  if (!input) return input;
  let s = input;
  // numeric decimal &#39;
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return _;
    try {
      return String.fromCodePoint(code);
    } catch {
      return _;
    }
  });
  // numeric hex &#x27;
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
    const code = parseInt(h, 16);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return _;
    try {
      return String.fromCodePoint(code);
    } catch {
      return _;
    }
  });
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  s = s.replace(/&([a-zA-Z]+);/g, (full, name) =>
    Object.prototype.hasOwnProperty.call(named, name) ? named[name] : full
  );
  return s;
}
