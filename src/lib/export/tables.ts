import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Every Prisma model with its table name and scalar columns (from the generated DMMF). */
export type TableInfo = { model: string; table: string; columns: string[]; hasId: boolean };

export function listTables(): TableInfo[] {
  return Prisma.dmmf.datamodel.models.map((m) => {
    const scalars = m.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
    return {
      model: m.name,
      table: m.dbName ?? m.name,
      columns: scalars.map((f) => f.dbName ?? f.name),
      hasId: scalars.some((f) => f.name === "id"),
    };
  });
}

/**
 * Columns never written to CSV/JSON copies. They stay in the pg_dump (full
 * backup only), because a restore needs them: users keep their passwords,
 * invite codes keep working. Sessions / reset tokens are secrets in any form.
 */
export const REDACTED_COLUMNS: Record<string, string[]> = {
  User: ["passwordHash"],
  Session: ["token"],
  PasswordResetToken: ["tokenHash"],
  Household: ["inviteCode"],
  ExportJob: ["linkTokenHash"],
};
/** Safety net for future columns: anything that looks like a credential. */
export const SECRET_COLUMN_RE = /(password|secret|token|api_?key|private_?key|credential)/i;

export function redactedColumnsFor(t: TableInfo): string[] {
  const fixed = REDACTED_COLUMNS[t.model] ?? [];
  return t.columns.filter((c) => fixed.includes(c) || SECRET_COLUMN_RE.test(c));
}

export type Row = Record<string, unknown>;

export function redactRow(t: TableInfo, row: Row): Row {
  const drop = new Set(redactedColumnsFor(t));
  const out: Row = {};
  for (const c of t.columns) if (!drop.has(c)) out[c] = row[c];
  return out;
}

function plain(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Prisma.Decimal) return v.toString();
  if (Buffer.isBuffer(v)) return v.toString("base64");
  return v;
}

export async function readTable(t: TableInfo, where?: { sql: string; params: unknown[] }): Promise<Row[]> {
  const cols = t.columns.map((c) => `"${c}"`).join(", ");
  const order = t.hasId ? ` ORDER BY "id"` : "";
  const sql = `SELECT ${cols} FROM "${t.table}"${where ? ` WHERE ${where.sql}` : ""}${order}`;
  const rows = (await prisma.$queryRawUnsafe(sql, ...(where?.params ?? []))) as Row[];
  return rows.map((r) => {
    const o: Row = {};
    for (const c of t.columns) o[c] = plain(r[c]);
    return o;
  });
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) || /^[=+\-@\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV. Cells that start like a formula are quoted (spreadsheet safety). */
export function toCsv(columns: string[], rows: Row[]): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}
