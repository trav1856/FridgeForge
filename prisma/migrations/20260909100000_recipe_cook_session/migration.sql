-- CreateTable
CREATE TABLE "RecipeCookSession" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT,
    "householdId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deductionsJson" TEXT NOT NULL DEFAULT '[]',
    "lowStockJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeCookSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeCookSession_recipeId_idx" ON "RecipeCookSession"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeCookSession_userId_idx" ON "RecipeCookSession"("userId");

-- CreateIndex
CREATE INDEX "RecipeCookSession_householdId_idx" ON "RecipeCookSession"("householdId");

-- CreateIndex
CREATE INDEX "RecipeCookSession_recipeId_householdId_active_idx" ON "RecipeCookSession"("recipeId", "householdId", "active");

-- CreateIndex
CREATE INDEX "RecipeCookSession_recipeId_userId_active_idx" ON "RecipeCookSession"("recipeId", "userId", "active");

-- AddForeignKey
ALTER TABLE "RecipeCookSession" ADD CONSTRAINT "RecipeCookSession_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeCookSession" ADD CONSTRAINT "RecipeCookSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeCookSession" ADD CONSTRAINT "RecipeCookSession_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
