-- CreateTable
CREATE TABLE "WeeklyMenuPlan" (
    "id" TEXT NOT NULL,
    "householdId" TEXT,
    "userId" TEXT,
    "planJson" TEXT NOT NULL,
    "struggleMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyMenuPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyMenuPlan_householdId_idx" ON "WeeklyMenuPlan"("householdId");

-- CreateIndex
CREATE INDEX "WeeklyMenuPlan_userId_idx" ON "WeeklyMenuPlan"("userId");

-- AddForeignKey
ALTER TABLE "WeeklyMenuPlan" ADD CONSTRAINT "WeeklyMenuPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMenuPlan" ADD CONSTRAINT "WeeklyMenuPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
