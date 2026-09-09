-- CreateTable
CREATE TABLE "RecipeRequest" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT,
    "householdId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeRequest_recipeId_idx" ON "RecipeRequest"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeRequest_fromUserId_idx" ON "RecipeRequest"("fromUserId");

-- CreateIndex
CREATE INDEX "RecipeRequest_toUserId_idx" ON "RecipeRequest"("toUserId");

-- CreateIndex
CREATE INDEX "RecipeRequest_householdId_idx" ON "RecipeRequest"("householdId");

-- CreateIndex
CREATE INDEX "RecipeRequest_status_idx" ON "RecipeRequest"("status");

-- AddForeignKey
ALTER TABLE "RecipeRequest" ADD CONSTRAINT "RecipeRequest_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRequest" ADD CONSTRAINT "RecipeRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRequest" ADD CONSTRAINT "RecipeRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRequest" ADD CONSTRAINT "RecipeRequest_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
