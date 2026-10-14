import { createHash } from "crypto";
import { spawn, execFile } from "child_process";
import { createReadStream, createWriteStream, openAsBlob } from "fs";
import { mkdir, readdir, rm, stat, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { Writable } from "stream";
import { promisify } from "util";
import { prisma } from "@/lib/db";
import {
  listTables,
  readTable,
  redactRow,
  redactedColumnsFor,
  toCsv,
  type Row,
  type TableInfo,
} from "@/lib/export/tables";
import { CONTENT_IMPORT_SCRIPT, contentReadme, restoreMd, RESTORE_SH, userReadme } from "@/lib/export/docs";

export type ExportKind = "full" | "user" | "content";

/** Upload folders under public/ (all runtime-written; gitignored). */
export const UPLOAD_DIRS = [
  "recipe-images/user", // recipe photos + story media
  "recipe-images/import", // recipe import page scans
  "profile-images/u", // avatars + banners
  "pantry-images/user",
  "product-images/shared",
  "product-images/household",
  "badge-images",
  "content-images", // chef photos, Kitchen Table covers + inline photos
] as const;

export const ENCRYPTION_METHOD = "AES-256 (WinZip AE-2) via @zip.js/zip.js";

const USER_COL_RE = /^(userId|ownerUserId|fromUserId|toUserId|targetUserId|createdById|createdByUserId|disabledById|actorId|authorUserId)$/;
const HH_COL_RE = /^(householdId|toHouseholdId|createdByHouseholdId)$/;
const EMAIL_COL_RE = /^(email|toUserEmail)$/;
const LOCAL_IMG_RE = /\/(recipe-images|badge-images|product-images\/shared|pantry-images|profile-images|content-images)\/[A-Za-z0-9._\/-]+\.(?:jpe?g|png|webp|gif|svg)/g;

export function exportDir(): string {
  return process.env.FF_EXPORT_DIR || path.join(process.cwd(), "ops", "exports");
}
function publicDir() {
  return path.join(process.cwd(), "public");
}

export function pgBinDir(): string {
  return process.env.FF_PG_BIN || path.join(os.homedir(), "pgtools", "pgsql", "bin");
}

/** libpq env from DATABASE_URL, so the password never appears in argv or logs. */
export function pgEnvFromUrl(url: string): Record<string, string> {
  const u = new URL(url);
  const env: Record<string, string> = {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")),
    PGUSER: decodeURIComponent(u.username),
    PGCONNECT_TIMEOUT: u.searchParams.get("connect_timeout") || "30",
  };
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password);
  const ssl = u.searchParams.get("sslmode");
  if (ssl) env.PGSSLMODE = ssl;
  return env;
}

export type ManifestFile = { path: string; bytes: number; sha256: string };
export type Manifest = {
  format: "fridgeforge-export";
  formatVersion: 1;
  kind: ExportKind;
  createdAt: string;
  app: { name: string; version: string; gitCommit: string | null };
  prismaMigrations: { latest: string | null; applied: number };
  postgres: { serverVersion: string | null; pgDumpVersion: string | null } | null;
  targetUser: { id: string } | null;
  rowCounts: Record<string, number>;
  redactedColumns: Record<string, string[]>;
  encryption: string;
  notes: string[];
  files: ManifestFile[];
};

type Entry = { path: string; text?: string; file?: string; bytes: number; sha256: string };

function sha256Text(s: string | Buffer) {
  return createHash("sha256").update(s).digest("hex");
}
async function sha256File(p: string): Promise<string> {
  const h = createHash("sha256");
  await new Promise<void>((res, rej) => {
    createReadStream(p).on("data", (d) => h.update(d)).on("end", () => res()).on("error", rej);
  });
  return h.digest("hex");
}

class Bundle {
  entries: Entry[] = [];
  addText(p: string, text: string) {
    this.entries.push({ path: p, text, bytes: Buffer.byteLength(text), sha256: sha256Text(text) });
  }
  async addFile(p: string, abs: string) {
    const st = await stat(abs);
    this.entries.push({ path: p, file: abs, bytes: st.size, sha256: await sha256File(abs) });
  }
  files(): ManifestFile[] {
    return this.entries.map((e) => ({ path: e.path, bytes: e.bytes, sha256: e.sha256 }));
  }
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let names: import("fs").Dirent[];
  try {
    names = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const d of names) {
    if (d.name.startsWith(".")) continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...(await walk(p)));
    else if (d.isFile()) out.push(p);
  }
  return out;
}

export async function uploadsSizeBytes(): Promise<number> {
  let n = 0;
  for (const d of UPLOAD_DIRS) for (const f of await walk(path.join(publicDir(), d))) n += (await stat(f)).size;
  return n;
}

async function gitCommit(): Promise<string | null> {
  if (process.env.FF_GIT_COMMIT) return process.env.FF_GIT_COMMIT;
  try {
    const { stdout } = await promisify(execFile)("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), timeout: 5000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function appVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(await (await import("fs/promises")).readFile(path.join(process.cwd(), "package.json"), "utf8"));
    return String(pkg.version || "unknown");
  } catch {
    return "unknown";
  }
}

async function migrationLevel() {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`
    )) as { migration_name: string }[];
    return { latest: rows.at(-1)?.migration_name ?? null, applied: rows.length };
  } catch {
    return { latest: null, applied: 0 };
  }
}

async function serverVersion(): Promise<string | null> {
  try {
    const r = (await prisma.$queryRawUnsafe(`SELECT current_setting('server_version') AS v`)) as { v: string }[];
    return r[0]?.v ?? null;
  } catch {
    return null;
  }
}

function runPgDump(outFile: string): Promise<string> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const bin = path.join(pgBinDir(), "pg_dump");
  return new Promise((resolve, reject) => {
    // Custom format, everything (schema, data, owners, ACLs). Restore decides what to skip.
    const child = spawn(bin, ["-Fc", "--no-password", "-f", outFile], {
      env: { PATH: process.env.PATH || "/usr/bin:/bin", HOME: os.homedir(), ...pgEnvFromUrl(url) } as unknown as NodeJS.ProcessEnv,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (d) => { err = (err + String(d)).slice(-2000); });
    child.on("error", (e) => reject(new Error(`pg_dump failed to start: ${e.message}`)));
    child.on("close", async (code) => {
      if (code !== 0) return reject(new Error(`pg_dump exited ${code}: ${err.replace(/password[^\s]*/gi, "***").slice(0, 300)}`));
      try {
        const { stdout } = await promisify(execFile)(bin, ["--version"]);
        resolve(stdout.trim());
      } catch {
        resolve("pg_dump (version unknown)");
      }
    });
  });
}

/** Write the zip (optionally AES-256 encrypted) with streaming readers. */
async function writeZip(outFile: string, entries: Entry[], password: string | null) {
  const zip = await import("@zip.js/zip.js");
  zip.configure({ useWebWorkers: false });
  const ws = Writable.toWeb(createWriteStream(outFile, { mode: 0o600 })) as WritableStream<Uint8Array>;
  const writer = new zip.ZipWriter(ws, password ? { password, encryptionStrength: 3, zipCrypto: false } : {});
  for (const e of entries) {
    const reader = e.file ? new zip.BlobReader(await openAsBlob(e.file)) : new zip.TextReader(e.text ?? "");
    await writer.add(e.path, reader, { level: e.path.endsWith(".dump") || /\.(jpe?g|png|webp|gif)$/i.test(e.path) ? 0 : 6 });
  }
  await writer.close();
}

// ---------------- table selection per export kind ----------------

type Selection = { t: TableInfo; rows: Row[] }[];

async function selectAll(tables: TableInfo[]): Promise<Selection> {
  const out: Selection = [];
  for (const t of tables) out.push({ t, rows: (await readTable(t)).map((r) => redactRow(t, r)) });
  return out;
}

export async function selectUser(tables: TableInfo[], userId: string): Promise<{ sel: Selection; householdIds: string[] }> {
  const user = (await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }))!;
  const memberships = await prisma.householdMember.findMany({ where: { userId }, select: { householdId: true } });
  const hh = memberships.map((m) => m.householdId);
  const recipeIds = (
    await prisma.recipe.findMany({
      where: { OR: [{ ownerUserId: userId }, ...(hh.length ? [{ householdId: { in: hh } }] : [])] },
      select: { id: true },
    })
  ).map((r) => r.id);
  const sel: Selection = [];
  for (const t of tables) {
    let where: { sql: string; params: unknown[] } | null = null;
    if (t.model === "User") where = { sql: `"id" = $1`, params: [userId] };
    else if (t.model === "Household") where = hh.length ? { sql: `"id" = ANY($1)`, params: [hh] } : null;
    else if (t.model === "RecipeIngredient") where = recipeIds.length ? { sql: `"recipeId" = ANY($1)`, params: [recipeIds] } : null;
    else {
      const conds: string[] = [];
      const params: unknown[] = [];
      for (const c of t.columns) {
        if (USER_COL_RE.test(c)) { params.push(userId); conds.push(`"${c}" = $${params.length}`); }
        else if (HH_COL_RE.test(c) && hh.length) { params.push(hh); conds.push(`"${c}" = ANY($${params.length})`); }
        else if (EMAIL_COL_RE.test(c)) { params.push(user.email); conds.push(`lower("${c}") = lower($${params.length})`); }
      }
      where = conds.length ? { sql: conds.join(" OR "), params } : null;
    }
    if (!where) continue; // catalog tables (badges, how-tos, ...) hold no personal data
    const rows = (await readTable(t, where)).map((r) => redactRow(t, r));
    if (rows.length) sel.push({ t, rows });
  }
  return { sel, householdIds: hh };
}

export const CONTENT_MODELS = [
  "HowToBadge", "HowToCourse", "HowToLesson", "StruggleResource",
  // Chef's Corner + The Kitchen Table: visible profiles, live posts, their pins (linked accounts removed).
  "FeaturedProfile", "Recipe", "RecipeIngredient", "SharedProduct", "Post", "FeaturedPin",
];

/** Content only: public/global recipes, how-tos, badges, shared products. Personal links nulled. */
export async function selectContent(tables: TableInfo[]): Promise<Selection> {
  const byModel = new Map(tables.map((t) => [t.model, t]));
  const sel: Selection = [];
  const recipes = await readTable(byModel.get("Recipe")!, { sql: `"visibility" IN ('global','public')`, params: [] });
  const ids = recipes.map((r) => r.id as string);
  const profT = byModel.get("FeaturedProfile");
  const visibleProfiles = new Set(profT ? (await readTable(profT, { sql: `"hidden" = false`, params: [] })).map((r) => r.id as string) : []);
  for (const m of CONTENT_MODELS) {
    const t = byModel.get(m);
    if (!t) continue;
    let rows: Row[];
    if (m === "Recipe") rows = recipes;
    else if (m === "RecipeIngredient") rows = ids.length ? await readTable(t, { sql: `"recipeId" = ANY($1)`, params: [ids] }) : [];
    else if (m === "FeaturedProfile") rows = await readTable(t, { sql: `"hidden" = false`, params: [] });
    else if (m === "Post") rows = await readTable(t, { sql: `"status" IN ('published','scheduled') AND "publishedAt" <= now()`, params: [] });
    else if (m === "FeaturedPin") {
      const posts = sel.find((x) => x.t.model === "Post")?.rows.map((r) => r.id as string) ?? [];
      const profs = sel.find((x) => x.t.model === "FeaturedProfile")?.rows.map((r) => r.id as string) ?? [];
      rows = await readTable(t, { sql: `"postId" = ANY($1) OR "profileId" = ANY($2)`, params: [posts, profs] });
    }
    else rows = await readTable(t);
    rows = rows.map((r) => {
      const o = redactRow(t, r);
      for (const c of Object.keys(o)) if (USER_COL_RE.test(c) || HH_COL_RE.test(c) || EMAIL_COL_RE.test(c)) o[c] = null;
      if ((m === "Recipe" || m === "Post") && o.chefProfileId !== undefined && !visibleProfiles.has(o.chefProfileId as string)) o.chefProfileId = null;
      if (m === "Post" && o.profileId && !visibleProfiles.has(o.profileId as string)) o.profileId = null;
      return o;
    });
    sel.push({ t, rows });
  }
  return sel;
}

/** Local image paths referenced by exported rows (content/user exports). */
export function referencedImages(sel: Selection, allow: RegExp): string[] {
  const s = new Set<string>();
  for (const { rows } of sel) {
    const text = JSON.stringify(rows);
    for (const m of text.matchAll(LOCAL_IMG_RE)) if (allow.test(m[0]) && !m[0].includes("..")) s.add(m[0]);
  }
  return [...s].sort();
}

function addTables(b: Bundle, sel: Selection, dir: string) {
  for (const { t, rows } of sel) {
    const cols = t.columns.filter((c) => !redactedColumnsFor(t).includes(c));
    b.addText(`${dir}/${t.model}.csv`, toCsv(cols, rows));
    b.addText(`${dir}/${t.model}.json`, JSON.stringify(rows, null, 1));
  }
}

export type BuildResult = { file: string; fileName: string; sizeBytes: number; manifestSha256: string; manifest: Manifest };

/**
 * Build one export zip. The password (if any) only lives in memory for the
 * duration of this call; it is never stored or logged.
 */
export async function buildExportZip(opts: {
  jobId: string;
  kind: ExportKind;
  targetUserId?: string | null;
  password?: string | null;
  onProgress?: (msg: string) => Promise<void> | void;
}): Promise<BuildResult> {
  const progress = async (m: string) => opts.onProgress?.(m);
  const root = exportDir();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const work = path.join(root, `.work-${opts.jobId}`);
  await mkdir(work, { recursive: true, mode: 0o700 });
  const b = new Bundle();
  const tables = listTables();
  const notes: string[] = [];
  let pgDumpVersion: string | null = null;
  try {
    let sel: Selection;
    if (opts.kind === "full") {
      await progress("Dumping the database");
      const dump = path.join(work, "fridgeforge.dump");
      pgDumpVersion = await runPgDump(dump);
      await b.addFile("database/fridgeforge.dump", dump);
      await progress("Copying uploaded files");
      for (const d of UPLOAD_DIRS) {
        for (const f of await walk(path.join(publicDir(), d))) {
          await b.addFile(`uploads/${path.relative(publicDir(), f).split(path.sep).join("/")}`, f);
        }
      }
      await progress("Writing table copies");
      sel = await selectAll(tables);
      addTables(b, sel, "tables");
      b.addText("RESTORE.md", restoreMd({ serverVersion: await serverVersion(), pgDumpVersion }));
      b.addText("restore.sh", RESTORE_SH);
      notes.push(
        "database/fridgeforge.dump is a complete pg_dump (custom format) and includes password hashes, sessions, reset-token hashes and invite codes, because a restore needs them. Treat the zip as secret.",
        "tables/*.csv and *.json are convenience copies with credential columns removed (see redactedColumns)."
      );
    } else if (opts.kind === "user") {
      if (!opts.targetUserId) throw new Error("targetUserId required");
      await progress("Collecting the user's data");
      const r = await selectUser(tables, opts.targetUserId);
      sel = r.sel;
      addTables(b, sel, "data");
      const imgs = referencedImages(sel, /^\/(recipe-images\/user|recipe-images\/import|profile-images|pantry-images\/user|product-images|content-images)\//);
      for (const u of imgs) {
        const abs = path.join(publicDir(), u);
        try { await b.addFile(`uploads${u}`, abs); } catch { /* referenced but missing */ }
      }
      b.addText("README.md", userReadme(r.householdIds.length));
      notes.push(
        "Household data (pantry, shopping list, household recipes, members) is shared by every member of the household and may include other members' entries.",
        "No database dump is included. Credential columns are removed."
      );
    } else {
      await progress("Collecting content");
      sel = await selectContent(tables);
      addTables(b, sel, "content");
      const imgs = referencedImages(sel, /^\/(recipe-images\/(?!import\/)|badge-images\/|product-images\/shared\/|content-images\/)/);
      for (const u of imgs) {
        const abs = path.join(publicDir(), u);
        try { await b.addFile(`uploads${u}`, abs); } catch { /* referenced but missing */ }
      }
      b.addText("README.md", contentReadme());
      b.addText("import-content.mjs", CONTENT_IMPORT_SCRIPT);
      notes.push(
        "Content only: global/public recipes (owner and household removed), how-to courses, lessons, badges, struggle resources and shared products (creator removed). No users, emails, households, pantries, reviews or sessions."
      );
    }

    // SHA256SUMS covers every file before it; MANIFEST.json.files covers SHA256SUMS too.
    b.addText("SHA256SUMS", b.files().map((f) => `${f.sha256}  ${f.path}`).join("\n") + "\n");

    const rowCounts: Record<string, number> = {};
    for (const { t, rows } of sel) rowCounts[t.model] = rows.length;
    const redactedColumns: Record<string, string[]> = {};
    for (const { t } of sel) {
      const r = redactedColumnsFor(t);
      if (r.length) redactedColumns[t.model] = r;
    }
    const manifest: Manifest = {
      format: "fridgeforge-export",
      formatVersion: 1,
      kind: opts.kind,
      createdAt: new Date().toISOString(),
      app: { name: "FridgeForge", version: await appVersion(), gitCommit: await gitCommit() },
      prismaMigrations: await migrationLevel(),
      postgres: opts.kind === "full" ? { serverVersion: await serverVersion(), pgDumpVersion } : null,
      targetUser: opts.kind === "user" ? { id: opts.targetUserId! } : null,
      rowCounts,
      redactedColumns,
      encryption: opts.password ? ENCRYPTION_METHOD : "none",
      notes,
      files: b.files(),
    };
    const manifestText = JSON.stringify(manifest, null, 2);
    const manifestSha256 = sha256Text(manifestText);
    b.addText("MANIFEST.json", manifestText);

    await progress("Writing the zip");
    const stamp = manifest.createdAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const fileName = `fridgeforge-${opts.kind}-${stamp}${opts.password ? "-encrypted" : ""}.zip`;
    const file = path.join(root, `${opts.jobId}.zip`);
    await writeZip(file, b.entries, opts.password ?? null);
    const st = await stat(file);
    return { file, fileName, sizeBytes: st.size, manifestSha256, manifest };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export async function writeFileSecure(p: string, data: string) {
  await writeFile(p, data, { mode: 0o600 });
}
