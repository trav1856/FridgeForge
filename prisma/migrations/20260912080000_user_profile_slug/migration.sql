-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileSlug" TEXT;

-- Backfill unique slugs from email local-part (or name), non-destructively
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN
    SELECT id, email, name
    FROM "User"
    WHERE "profileSlug" IS NULL
    ORDER BY "createdAt" ASC
  LOOP
    base := lower(split_part(r.email, '@', 1));
    base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
    base := regexp_replace(base, '^-+|-+$', '', 'g');
    IF base IS NULL OR length(base) < 2 THEN
      base := lower(coalesce(r.name, 'cook'));
      base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
      base := regexp_replace(base, '^-+|-+$', '', 'g');
    END IF;
    IF base IS NULL OR length(base) < 2 THEN
      base := 'cook';
    END IF;
    base := left(base, 48);
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM "User" WHERE "profileSlug" = candidate) LOOP
      n := n + 1;
      candidate := left(base, greatest(1, 48 - length('-' || n::text))) || '-' || n::text;
    END LOOP;
    UPDATE "User" SET "profileSlug" = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_profileSlug_key" ON "User"("profileSlug");
