# Admin export / backup (/admin/export)

Admin only. Every POST checks same-origin (`src/lib/same-origin.ts`).

## Kinds
- **Full backup**: `database/fridgeforge.dump` (`pg_dump -Fc`, everything),
  `uploads/` (recipe-images/user, recipe-images/import, profile-images/u,
  pantry-images/user, product-images/shared|household, badge-images),
  `tables/<Model>.csv|json` for every Prisma model, `MANIFEST.json`,
  `SHA256SUMS`, `RESTORE.md`, `restore.sh`.
- **One user**: `data/<Model>.csv|json` for rows tied to the user (user id
  columns, their households, their recipes' ingredients, rows addressed to their
  email), the files those rows reference, `README.md` with the household note.
  No dump.
- **Content only**: global/public recipes + ingredients, how-to badges,
  courses, lessons, struggle resources, shared products, visible Chef's Corner
  profiles, live Kitchen Table posts and their home pins, with every user and
  household column set to null; referenced images; `import-content.mjs`.

## Secrets
- Never in any zip: `.env`, `ops/.hoth-pg.env`, API keys, server config.
- CSV/JSON never contain `User.passwordHash`, `Session.token`,
  `PasswordResetToken.tokenHash`, `Household.inviteCode`,
  `ExportJob.linkTokenHash`, or any column whose name looks like a credential.
- The full backup's pg_dump keeps them all, because a restore must keep
  passwords, sessions and invite codes working. Treat full backups as secret.
- pg_dump gets the DB password through `PGPASSWORD` in its environment (parsed
  from `DATABASE_URL`), never argv. `restore.sh` reads libpq env vars.

## Storage, links, limits
- Zips: `FF_EXPORT_DIR` (default `ops/exports/`, outside `public/`), dir 0700,
  files 0600. Deleted 1 hour after they finish (sweep on every export request
  and every 5 minutes).
- Download links: one-time token (32 random bytes; only its sha256 is stored),
  valid ≤1 hour and never past the file's expiry. Needs an admin session too.
- One build at a time; at most 6 exports per admin per hour; free disk checked
  against an estimate before building.
- Optional password: AES-256 (WinZip AE-2) via `@zip.js/zip.js`. File names
  inside the zip remain visible. Open with 7-Zip / Keka / `7z x`.
- Audit log: `export.create` (who, kind, target user, size, manifest sha256,
  encrypted, time), `export.download`, `export.failed`.
- `pg_dump` binary: `FF_PG_BIN` (default `~/pgtools/pgsql/bin`).
