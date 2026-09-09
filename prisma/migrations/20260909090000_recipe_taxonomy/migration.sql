-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "cuisine" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "course" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "foodCategories" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Recipe" ADD COLUMN "origins" TEXT NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "Recipe_cuisine_idx" ON "Recipe"("cuisine");

-- CreateIndex
CREATE INDEX "Recipe_course_idx" ON "Recipe"("course");
