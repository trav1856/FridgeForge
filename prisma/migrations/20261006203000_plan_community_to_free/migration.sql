-- Rename default plan community → free (user-facing: no plan label; paid remains internal "pro", display Premium)
UPDATE "User" SET "plan" = 'free' WHERE "plan" = 'community';
ALTER TABLE "User" ALTER COLUMN "plan" SET DEFAULT 'free';
