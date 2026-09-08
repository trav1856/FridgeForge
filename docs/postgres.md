# FridgeForge → Endor Postgres

FridgeForge uses **PostgreSQL** via Prisma (`provider = "postgresql"`).

## Connection

Set `DATABASE_URL` in `.env` (gitignored). On Corelia, the live app URL is kept in:

```text
ops/.env.postgres.local
```

Copy it into `.env` (or symlink) before `next dev` / Prisma commands:

```bash
cp ops/.env.postgres.local .env
# or: set -a; source ops/.env.postgres.local; set +a
```

Example shape (placeholder password):

```text
DATABASE_URL="postgresql://fridgeforge_app:CHANGE_ME@192.168.1.87:2665/fridgeforge?schema=public"
```

Notes:

- Endor Postgres listens on port **2665** (not 5432).
- Database name: `fridgeforge`. Role: `fridgeforge_app`.
- Never point FridgeForge at `solididea_DB`.
- Do not commit `.env`, `ops/.env.postgres.local`, or any password.

## Apply schema

Prefer migrations when present:

```bash
npx prisma migrate deploy
```

If there is no migration history yet (first cutover):

```bash
npx prisma db push
npx prisma generate
```

## Data cutover (SQLite → Postgres)

1. Timestamped SQLite backup under `ops/backups/`.
2. Point `.env` at Postgres and `db push`.
3. Run `npx tsx prisma/migrate-sqlite-to-postgres.ts` (reads `prisma/dev.db` or `SQLITE_PATH`).
4. Verify row counts; restart the app.

Seed remains **non-destructive** (`bun run db:seed`). Never use `db:seed:reset` / `FF_FORCE_RESET` against production data.
