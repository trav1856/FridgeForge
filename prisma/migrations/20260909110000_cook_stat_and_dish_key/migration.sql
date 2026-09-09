-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "dishKey" TEXT;

-- CreateIndex
CREATE INDEX "Recipe_dishKey_idx" ON "Recipe"("dishKey");

-- CreateTable
CREATE TABLE "RecipeCookStat" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "userId" TEXT,
    "householdId" TEXT,
    "cookCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeCookStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeCookStat_recipeId_idx" ON "RecipeCookStat"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeCookStat_userId_idx" ON "RecipeCookStat"("userId");

-- CreateIndex
CREATE INDEX "RecipeCookStat_householdId_idx" ON "RecipeCookStat"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeCookStat_recipeId_scopeKey_key" ON "RecipeCookStat"("recipeId", "scopeKey");

-- AddForeignKey
ALTER TABLE "RecipeCookStat" ADD CONSTRAINT "RecipeCookStat_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeCookStat" ADD CONSTRAINT "RecipeCookStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeCookStat" ADD CONSTRAINT "RecipeCookStat_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
