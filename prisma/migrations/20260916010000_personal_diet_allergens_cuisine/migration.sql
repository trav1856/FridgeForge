-- Personal allergen flags (JSON string array) + recipe allergen tags + halal adapt note
ALTER TABLE "User" ADD COLUMN "allergenFlags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Recipe" ADD COLUMN "allergenTags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Recipe" ADD COLUMN "halalAdaptNote" TEXT;
