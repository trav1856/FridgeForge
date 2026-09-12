-- AlterTable: badge image + kind (non-destructive)
ALTER TABLE "HowToBadge" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "HowToBadge" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'howto';

-- Existing rows stay howto (default already applied)
UPDATE "HowToBadge" SET "kind" = 'howto' WHERE "kind" IS NULL OR "kind" = '';
