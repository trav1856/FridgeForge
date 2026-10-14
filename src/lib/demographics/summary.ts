import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CONSENT_TEXT } from "@/lib/demographics/options";
import { DIMENSIONS, type Cell, type Report } from "@/lib/demographics/analytics";

const SUP = "<20";
const val = (n: number | null) => (n === null ? SUP : String(n));
function csvCell(v: string) {
  const s = /^[=+\-@\t\r]/.test(v) && v !== SUP ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Executive summary CSV: aggregate rows only; suppressed values are written as "<20". */
export function summaryCsv(r: Report): string {
  const lines: string[][] = [
    ["# FridgeForge executive summary: recipe views and favorites by cuisine"],
    [`# Generated ${r.generatedAt}. Consenting users aged 16+ only. Any value backed by fewer than ${r.k} users is shown as ${SUP}.`],
    ["section", "dimension", "group", "group_users", "cuisine", "viewers", "views", "favoriting_users", "favorites"],
    ["cohort", "", "", val(r.cohortSize), "", "", "", "", ""],
  ];
  const row = (sec: string, dim: string, g: string, size: number | null, c: string, cell: Cell) =>
    [sec, dim, g, val(size), c, val(cell.users), val(cell.views), val(cell.favoriteUsers), val(cell.favorites)];
  for (const c of r.cuisines) lines.push(row("overall", "", "All", r.cohortSize, c, r.overall[c]!));
  for (const d of DIMENSIONS) {
    const dim = r.dimensions[d.id];
    for (const g of dim.groups) for (const c of r.cuisines) lines.push(row("breakdown", d.label, g.label, g.size, c, g.cells[c]!));
    if (dim.suppressedGroups) lines.push(["suppressed_groups", d.label, "", "", "", "", "", "", String(dim.suppressedGroups)]);
  }
  return lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Executive summary PDF (pdf-lib, standard Helvetica). No identifiers. */
export async function summaryPdf(r: Report): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("FridgeForge executive summary");
  doc.setCreator("FridgeForge");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([612, 792]);
  let y = 740;
  const L = 54, W = 504;
  const ensure = (h: number) => { if (y - h < 54) { page = doc.addPage([612, 792]); y = 740; } };
  const wrap = (text: string, f: PDFFont, size: number, width: number) => {
    const out: string[] = []; let line = "";
    for (const w of text.split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line); return out;
  };
  const text = (t: string, opts: { size?: number; f?: PDFFont; color?: [number, number, number]; gap?: number } = {}) => {
    const size = opts.size ?? 10, f = opts.f ?? font;
    for (const ln of wrap(t, f, size, W)) { ensure(size + 4); page.drawText(ln, { x: L, y, size, font: f, color: rgb(...(opts.color ?? [0.2, 0.22, 0.18])) }); y -= size + 4; }
    y -= opts.gap ?? 4;
  };
  const table = (head: string[], rows: string[][], widths: number[]) => {
    const draw = (cells: string[], f: PDFFont) => {
      ensure(16); let x = L;
      cells.forEach((c, i) => { let s = c; while (f.widthOfTextAtSize(s, 9) > widths[i]! - 6 && s.length > 3) s = s.slice(0, -2) + "…"; page.drawText(s, { x, y, size: 9, font: f, color: rgb(0.2, 0.22, 0.18) }); x += widths[i]!; });
      y -= 14;
    };
    draw(head, bold);
    page.drawLine({ start: { x: L, y: y + 10 }, end: { x: L + W, y: y + 10 }, thickness: 0.5, color: rgb(0.8, 0.78, 0.72) });
    for (const rr of rows) draw(rr, font);
    y -= 8;
  };

  text("FridgeForge executive summary", { size: 20, f: bold, color: [0.76, 0.25, 0.05] });
  text("Recipe views and favorites by cuisine", { size: 13, f: bold });
  text(`Generated ${r.generatedAt.replace("T", " ").slice(0, 16)} UTC`, { size: 9, color: [0.45, 0.5, 0.39], gap: 10 });
  text("Method", { size: 12, f: bold });
  text(`Includes only users who opted in to research sharing and confirmed they are 16 or older. Values are aggregates; any figure or group backed by fewer than ${r.k} users is suppressed (shown as ${SUP}) or omitted. No names, emails, user ids or other identifiers are included.`);
  text(`Consent text shown to users: "${CONSENT_TEXT}"`, { size: 9, color: [0.45, 0.5, 0.39], gap: 10 });
  text("Cohort", { size: 12, f: bold });
  text(r.cohortSize === null ? `Fewer than ${r.k} eligible users so far. No breakdowns can be reported yet.` : `${r.cohortSize} eligible users.`, { gap: 10 });
  if (r.cohortSize !== null) {
    text("Top cuisines overall", { size: 12, f: bold });
    table(["Cuisine", "Viewers", "Views", "Favoriting users", "Favorites"],
      r.cuisines.slice(0, 15).map((c) => { const x = r.overall[c]!; return [c, val(x.users), val(x.views), val(x.favoriteUsers), val(x.favorites)]; }),
      [180, 80, 80, 100, 64]);
    for (const d of DIMENSIONS) {
      const dim = r.dimensions[d.id];
      text(`By ${d.label.toLowerCase()}`, { size: 12, f: bold });
      if (!dim.groups.length) { text(`No group has ${r.k}+ users yet.`, { gap: 8 }); continue; }
      const rows: string[][] = [];
      for (const g of dim.groups) {
        const top = r.cuisines.filter((c) => g.cells[c]!.views !== null).sort((a, b) => g.cells[b]!.views! - g.cells[a]!.views!).slice(0, 3);
        rows.push([g.label, String(g.size), top.length ? top.map((c) => `${c} (${g.cells[c]!.views})`).join(", ") : SUP]);
      }
      table(["Group", "Users", "Top cuisines by views (reportable only)"], rows, [150, 50, 304]);
      if (dim.suppressedGroups) text(`${dim.suppressedGroups} smaller group(s) omitted.`, { size: 9, color: [0.45, 0.5, 0.39] });
    }
  }
  return doc.save();
}
