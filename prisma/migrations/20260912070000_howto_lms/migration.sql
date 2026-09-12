-- CreateTable
CREATE TABLE "HowToBadge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🏅',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HowToBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HowToCourse" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "badgeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HowToCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HowToLesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HowToLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HowToLessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HowToLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HowToUserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "courseId" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HowToUserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HowToBadge_slug_key" ON "HowToBadge"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HowToCourse_slug_key" ON "HowToCourse"("slug");

-- CreateIndex
CREATE INDEX "HowToCourse_sortOrder_idx" ON "HowToCourse"("sortOrder");

-- CreateIndex
CREATE INDEX "HowToCourse_badgeId_idx" ON "HowToCourse"("badgeId");

-- CreateIndex
CREATE INDEX "HowToLesson_courseId_idx" ON "HowToLesson"("courseId");

-- CreateIndex
CREATE INDEX "HowToLesson_sortOrder_idx" ON "HowToLesson"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "HowToLesson_courseId_slug_key" ON "HowToLesson"("courseId", "slug");

-- CreateIndex
CREATE INDEX "HowToLessonProgress_userId_idx" ON "HowToLessonProgress"("userId");

-- CreateIndex
CREATE INDEX "HowToLessonProgress_lessonId_idx" ON "HowToLessonProgress"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "HowToLessonProgress_userId_lessonId_key" ON "HowToLessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "HowToUserBadge_userId_idx" ON "HowToUserBadge"("userId");

-- CreateIndex
CREATE INDEX "HowToUserBadge_badgeId_idx" ON "HowToUserBadge"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "HowToUserBadge_userId_badgeId_key" ON "HowToUserBadge"("userId", "badgeId");

-- AddForeignKey
ALTER TABLE "HowToCourse" ADD CONSTRAINT "HowToCourse_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "HowToBadge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HowToLesson" ADD CONSTRAINT "HowToLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "HowToCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HowToLessonProgress" ADD CONSTRAINT "HowToLessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HowToLessonProgress" ADD CONSTRAINT "HowToLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "HowToLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HowToUserBadge" ADD CONSTRAINT "HowToUserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HowToUserBadge" ADD CONSTRAINT "HowToUserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "HowToBadge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
