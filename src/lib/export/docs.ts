/** Text files shipped inside export zips. No credentials: everything comes from env at restore time. */

export function restoreMd(v: { serverVersion: string | null; pgDumpVersion: string | null }) {
  return `# Restoring a FridgeForge full backup

This zip is a complete backup: the Postgres database, every uploaded file, and
CSV/JSON copies of every table. Treat it as secret. The database dump contains
password hashes, session tokens, reset-token hashes and household invite codes,
because a working restore needs them.

## What is inside

- \`database/fridgeforge.dump\`: \`pg_dump\` custom format (schema + data).
  Made from PostgreSQL ${v.serverVersion ?? "(unknown)"} with ${v.pgDumpVersion ?? "pg_dump"}.
- \`uploads/\`: files that belong under the app's \`public/\` folder
  (recipe photos and story media, imported recipe scans, profile avatars and
  banners, pantry photos, shared/household product photos, badge images).
- \`tables/<Model>.csv\` and \`.json\`: one per table, for reading or
  spreadsheets. Credential columns are removed from these copies only (see
  \`MANIFEST.json\` → \`redactedColumns\`). Do not restore from them; use the dump.
- \`MANIFEST.json\`: app version, git commit, Prisma migration level, row
  counts and the SHA-256 of every file. \`SHA256SUMS\` has the same hashes in
  \`shasum\` format.
- \`restore.sh\`: the steps below as a script.

## Requirements on the new host

- PostgreSQL server **${(v.serverVersion ?? "18").split(" ")[0]} or newer** (the same major version is safest).
- PostgreSQL client tools of the same major version or newer: \`pg_restore\`,
  \`createdb\`, \`psql\`.
- Node.js 20+ and a FridgeForge checkout at the commit in \`MANIFEST.json\`
  (\`app.gitCommit\`), with \`npm ci\` done.
- \`shasum\` (macOS) or \`sha256sum\` (Linux) to check the files.

## Environment variables

Set these in your shell. Nothing in this zip contains credentials.

| Variable | Meaning |
| --- | --- |
| \`PGHOST\`, \`PGPORT\`, \`PGUSER\`, \`PGPASSWORD\` | Postgres connection used to create and fill the database |
| \`TARGET_DB\` | Name of the new database (default \`fridgeforge\`) |
| \`APP_DIR\` | Path to the FridgeForge checkout (uploads are copied into \`$APP_DIR/public\`) |
| \`DATABASE_URL\` | The app's connection string to the new database, for example \`postgresql://USER:PASSWORD@HOST:PORT/TARGET_DB?schema=public\` |

The app also needs its usual settings in \`$APP_DIR/.env\` (\`DATABASE_URL\` and
any others you use). They are not in this backup on purpose.

## Steps

1. Unzip somewhere private. If the zip is encrypted you need its password
   (AES-256; use 7-Zip, Keka, or \`7z x file.zip\`; macOS Archive Utility and
   the old \`unzip\` cannot open AES zips).
2. Check the files: \`cd <unzipped> && shasum -a 256 -c SHA256SUMS\`.
3. Create the database: \`createdb "$TARGET_DB"\`.
4. Restore: \`pg_restore --no-owner --no-acl -d "$TARGET_DB" database/fridgeforge.dump\`.
   \`--no-owner --no-acl\` makes the restoring user own everything, which is
   what you want on a new host with different role names.
5. Copy uploads: \`cp -R uploads/. "$APP_DIR/public/"\`.
6. In \`$APP_DIR\` with \`DATABASE_URL\` set: \`npx prisma migrate deploy\`
   (a no-op when the code matches the backup; it applies newer migrations
   otherwise), then \`npm run build\` and start the app.
7. Compare \`MANIFEST.json\` → \`rowCounts\` with the new database.

Or run \`./restore.sh\` with the variables above set; it does steps 2 to 6.
`;
}

export const RESTORE_SH = `#!/usr/bin/env bash
# Restore a FridgeForge full backup. Reads every credential from the environment:
#   PGHOST PGPORT PGUSER PGPASSWORD  (libpq; or use ~/.pgpass)
#   TARGET_DB    new database name (default fridgeforge)
#   APP_DIR      FridgeForge checkout (uploads go to $APP_DIR/public); set SKIP_APP=1 to skip
#   DATABASE_URL app connection string for prisma migrate deploy
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET_DB="\${TARGET_DB:-fridgeforge}"
: "\${PGHOST:?set PGHOST}" "\${PGUSER:?set PGUSER}"

echo "Checking file hashes"
cd "$HERE"
if command -v shasum >/dev/null; then shasum -a 256 -c SHA256SUMS >/dev/null; else sha256sum -c SHA256SUMS >/dev/null; fi

if psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB'" | grep -q 1; then
  if [ "\${ALLOW_EXISTING:-0}" != "1" ]; then
    echo "Database $TARGET_DB already exists. Pick another TARGET_DB or set ALLOW_EXISTING=1." >&2
    exit 1
  fi
else
  echo "Creating database $TARGET_DB"
  createdb "$TARGET_DB"
fi

echo "Restoring the dump"
pg_restore --no-owner --no-acl --exit-on-error -d "$TARGET_DB" "$HERE/database/fridgeforge.dump"

if [ "\${SKIP_APP:-0}" = "1" ]; then
  echo "SKIP_APP=1: not copying uploads or running migrations."
  exit 0
fi
: "\${APP_DIR:?set APP_DIR to the FridgeForge checkout}" "\${DATABASE_URL:?set DATABASE_URL}"
echo "Copying uploads into $APP_DIR/public"
mkdir -p "$APP_DIR/public"
cp -R "$HERE/uploads/." "$APP_DIR/public/" 2>/dev/null || true
echo "Applying migrations"
cd "$APP_DIR"
npx prisma migrate deploy
echo "Done. Build and start the app, then compare MANIFEST.json rowCounts."
`;

export function userReadme(households: number) {
  return `# FridgeForge personal data export

This export holds the data FridgeForge stores about one account, as CSV and
JSON (\`data/<Model>.csv|json\`), plus the photos it uploaded (\`uploads/\`).
\`MANIFEST.json\` lists row counts and the SHA-256 of every file.

What is included:
- The account profile (\`User\`) without the password hash.
- Recipes the person owns, their ingredients, favorites, reviews/comments,
  profile pins, recipe shares and requests sent or received, cooking history,
  how-to progress and badges, active days.
- Sign-in sessions (dates only; session tokens are removed) and admin audit
  entries about or by the account.
- Household data for the ${households} household(s) the person belongs to.

**Note on households:** pantry items, staples, shopping lists, coupons, weekly
menus, household recipes and the member list are shared by everyone in a
household. These files may contain entries created by other household members.
Review them before releasing this export to a third party.

Not included: a database dump, password hashes, session or reset tokens,
household invite codes, or any server configuration.
`;
}

export function contentReadme() {
  return `# FridgeForge content export (no personal data)

Moves catalog content to another FridgeForge install:
- \`content/Recipe\`, \`RecipeIngredient\`: global and public recipes only.
  Owner and household are removed (set to null).
- \`content/HowToBadge\`, \`HowToCourse\`, \`HowToLesson\`, \`StruggleResource\`.
- \`content/SharedProduct\`: the shared barcode catalog, creator removed.
- \`content/FeaturedProfile\`: Chef's Corner profiles that are visible, with the
  linked account removed (userId set to null), so they import as admin-managed chefs.
- \`content/Post\`: live Kitchen Table posts (no drafts), author account removed.
- \`content/FeaturedPin\`: home-page pins for those chefs and posts.
- \`uploads/\`: images those rows reference.

No users, emails, households, pantries, reviews, favorites or sessions.

## Import into a fresh FridgeForge database

1. In the new FridgeForge checkout, set \`DATABASE_URL\` and run
   \`npx prisma migrate deploy\`.
2. From that checkout: \`node /path/to/unzipped/import-content.mjs /path/to/unzipped\`.
   Existing rows with the same id are skipped, so it is safe to run twice.
3. Images are copied into \`./public\`.
`;
}

export const CONTENT_IMPORT_SCRIPT = `// Import a FridgeForge content export into the database at DATABASE_URL.
// Run from the FridgeForge checkout: node /path/import-content.mjs /path/to/unzipped
// Uses that checkout's @prisma/client. Reads no credentials except DATABASE_URL.
import { createRequire } from "module";
import { readFileSync, existsSync, mkdirSync, cpSync } from "fs";
import path from "path";

const dir = path.resolve(process.argv[2] || path.dirname(new URL(import.meta.url).pathname));
const appDir = process.cwd();
if (!process.env.DATABASE_URL) { console.error("Set DATABASE_URL"); process.exit(1); }
const require = createRequire(path.join(appDir, "package.json"));
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ORDER = ["HowToBadge", "HowToCourse", "HowToLesson", "StruggleResource", "FeaturedProfile", "Recipe", "RecipeIngredient", "SharedProduct", "Post", "FeaturedPin"];
const lower = (m) => m[0].toLowerCase() + m.slice(1);

async function main() {
  const counts = {};
  for (const model of ORDER) {
    const f = path.join(dir, "content", model + ".json");
    if (!existsSync(f)) continue;
    const rows = JSON.parse(readFileSync(f, "utf8"));
    let n = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const r = await prisma[lower(model)].createMany({ data: rows.slice(i, i + 200), skipDuplicates: true });
      n += r.count;
    }
    counts[model] = { inFile: rows.length, inserted: n };
  }
  const up = path.join(dir, "uploads");
  if (existsSync(up)) { mkdirSync(path.join(appDir, "public"), { recursive: true }); cpSync(up, path.join(appDir, "public"), { recursive: true }); }
  console.log(JSON.stringify(counts));
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e.message); await prisma.$disconnect(); process.exit(1); });
`;
