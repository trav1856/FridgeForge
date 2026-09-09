-- AlterTable
ALTER TABLE "RecipeShare" ADD COLUMN "toHouseholdId" TEXT;

-- CreateIndex
CREATE INDEX "RecipeShare_toHouseholdId_idx" ON "RecipeShare"("toHouseholdId");

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_toHouseholdId_fkey" FOREIGN KEY ("toHouseholdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
