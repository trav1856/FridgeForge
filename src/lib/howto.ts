import { prisma } from "@/lib/db";

export type HowToBadgeDTO = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
};

export type HowToLessonDTO = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  sortOrder: number;
  estimatedMinutes: number | null;
  completed: boolean;
  completedAt: string | null;
};

export type HowToCourseSummaryDTO = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessonCount: number;
  completedLessonCount: number;
  complete: boolean;
  badge: HowToBadgeDTO | null;
  badgeEarned: boolean;
};

export type HowToCourseDetailDTO = HowToCourseSummaryDTO & {
  lessons: HowToLessonDTO[];
};

/** Pure: every lesson id in the course is marked complete. */
export function isCourseComplete(
  lessonIds: string[],
  completedLessonIds: Iterable<string>
): boolean {
  if (lessonIds.length === 0) return false;
  const done = completedLessonIds instanceof Set
    ? completedLessonIds
    : new Set(completedLessonIds);
  return lessonIds.every((id) => done.has(id));
}

/** Pure: award when course becomes complete and a badge is configured. */
export function shouldAwardCourseBadge(opts: {
  lessonIds: string[];
  completedLessonIdsBefore: Iterable<string>;
  newlyCompletedLessonId: string;
  badgeId: string | null | undefined;
  alreadyHasBadge: boolean;
}): boolean {
  if (!opts.badgeId || opts.alreadyHasBadge) return false;
  const before = new Set(opts.completedLessonIdsBefore);
  if (before.has(opts.newlyCompletedLessonId)) {
    // Idempotent re-complete: only award if course was already complete and
    // somehow badge missing — normally false.
    return isCourseComplete(opts.lessonIds, before);
  }
  const after = new Set(before);
  after.add(opts.newlyCompletedLessonId);
  return isCourseComplete(opts.lessonIds, after);
}

export function serializeBadge(b: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
}): HowToBadgeDTO {
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    description: b.description,
    emoji: b.emoji,
  };
}

export async function listCoursesForUser(
  userId: string | null
): Promise<HowToCourseSummaryDTO[]> {
  const courses = await prisma.howToCourse.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      badge: true,
      lessons: { select: { id: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  const lessonIds = courses.flatMap((c) => c.lessons.map((l) => l.id));
  const completedIds = new Set<string>();
  const earnedBadgeIds = new Set<string>();

  if (userId && lessonIds.length) {
    const progress = await prisma.howToLessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    });
    for (const p of progress) completedIds.add(p.lessonId);
  }
  if (userId) {
    const awards = await prisma.howToUserBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });
    for (const a of awards) earnedBadgeIds.add(a.badgeId);
  }

  return courses.map((c) => {
    const ids = c.lessons.map((l) => l.id);
    const completedLessonCount = ids.filter((id) => completedIds.has(id)).length;
    const complete = isCourseComplete(ids, completedIds);
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      sortOrder: c.sortOrder,
      lessonCount: ids.length,
      completedLessonCount: userId ? completedLessonCount : 0,
      complete: userId ? complete : false,
      badge: c.badge ? serializeBadge(c.badge) : null,
      badgeEarned: c.badgeId ? earnedBadgeIds.has(c.badgeId) : false,
    };
  });
}

export async function getCourseDetail(
  courseSlug: string,
  userId: string | null
): Promise<HowToCourseDetailDTO | null> {
  const course = await prisma.howToCourse.findUnique({
    where: { slug: courseSlug },
    include: {
      badge: true,
      lessons: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }] },
    },
  });
  if (!course) return null;

  const lessonIds = course.lessons.map((l) => l.id);
  const completedMap = new Map<string, Date>();
  let badgeEarned = false;

  if (userId && lessonIds.length) {
    const progress = await prisma.howToLessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
    });
    for (const p of progress) completedMap.set(p.lessonId, p.completedAt);
  }
  if (userId && course.badgeId) {
    const award = await prisma.howToUserBadge.findUnique({
      where: {
        userId_badgeId: { userId, badgeId: course.badgeId },
      },
    });
    badgeEarned = Boolean(award);
  }

  const completedLessonCount = lessonIds.filter((id) =>
    completedMap.has(id)
  ).length;
  const complete = userId
    ? isCourseComplete(lessonIds, completedMap.keys())
    : false;

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    sortOrder: course.sortOrder,
    lessonCount: lessonIds.length,
    completedLessonCount: userId ? completedLessonCount : 0,
    complete,
    badge: course.badge ? serializeBadge(course.badge) : null,
    badgeEarned,
    lessons: course.lessons.map((l) => {
      const at = completedMap.get(l.id) ?? null;
      return {
        id: l.id,
        slug: l.slug,
        title: l.title,
        summary: l.summary,
        body: l.body,
        sortOrder: l.sortOrder,
        estimatedMinutes: l.estimatedMinutes,
        completed: userId ? Boolean(at) : false,
        completedAt: at ? at.toISOString() : null,
      };
    }),
  };
}

export type MarkLessonCompleteResult = {
  lessonId: string;
  alreadyComplete: boolean;
  courseComplete: boolean;
  badgeAwarded: HowToBadgeDTO | null;
};

/**
 * Mark a lesson complete for a signed-in user. When the parent course's
 * lessons are all complete and a badge is configured, award it (idempotent).
 */
export async function markLessonComplete(
  userId: string,
  lessonId: string
): Promise<MarkLessonCompleteResult | null> {
  const lesson = await prisma.howToLesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        include: {
          badge: true,
          lessons: { select: { id: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!lesson) return null;

  const courseLessonIds = lesson.course.lessons.map((l) => l.id);
  const prior = await prisma.howToLessonProgress.findMany({
    where: { userId, lessonId: { in: courseLessonIds } },
    select: { lessonId: true },
  });
  const priorIds = prior.map((p) => p.lessonId);
  const alreadyComplete = priorIds.includes(lessonId);

  if (!alreadyComplete) {
    await prisma.howToLessonProgress.create({
      data: { userId, lessonId },
    });
  }

  const afterIds = alreadyComplete
    ? priorIds
    : [...priorIds, lessonId];
  const courseComplete = isCourseComplete(courseLessonIds, afterIds);

  let badgeAwarded: HowToBadgeDTO | null = null;
  const badgeId = lesson.course.badgeId;
  if (badgeId && courseComplete) {
    const existing = await prisma.howToUserBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    });
    if (!existing) {
      const award = await prisma.howToUserBadge.create({
        data: {
          userId,
          badgeId,
          courseId: lesson.courseId,
        },
        include: { badge: true },
      });
      badgeAwarded = serializeBadge(award.badge);
    }
  }

  return {
    lessonId,
    alreadyComplete,
    courseComplete,
    badgeAwarded,
  };
}

export async function listUserBadges(
  userId: string
): Promise<(HowToBadgeDTO & { awardedAt: string; courseId: string | null })[]> {
  const awards = await prisma.howToUserBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { awardedAt: "desc" },
  });
  return awards.map((a) => ({
    ...serializeBadge(a.badge),
    awardedAt: a.awardedAt.toISOString(),
    courseId: a.courseId,
  }));
}
