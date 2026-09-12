import { prisma } from "@/lib/db";
import {
  deleteManagedBadgeImage,
  saveBadgeImageFile,
  validateBadgeImageUpload,
} from "@/lib/badge-images";
import { serializeBadge, type HowToBadgeDTO } from "@/lib/howto";
import {
  normalizeBadgeKind,
  slugifyBadgeTitle,
} from "@/lib/badges-shared";

export { normalizeBadgeKind, slugifyBadgeTitle } from "@/lib/badges-shared";

export type AdminBadgeDTO = HowToBadgeDTO & {
  createdAt: string;
  awardCount: number;
  courseCount: number;
  courses: { id: string; slug: string; title: string }[];
};

export type AdminCourseBadgeDTO = {
  id: string;
  slug: string;
  title: string;
  sortOrder: number;
  badgeId: string | null;
  badge: HowToBadgeDTO | null;
};

export async function uniquifyBadgeSlug(base: string): Promise<string> {
  const root = slugifyBadgeTitle(base);
  let candidate = root;
  let n = 1;
  while (await prisma.howToBadge.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${root.slice(0, Math.max(1, 48 - String(n).length - 1))}-${n}`;
  }
  return candidate;
}

export async function listAdminBadges(): Promise<AdminBadgeDTO[]> {
  const rows = await prisma.howToBadge.findMany({
    orderBy: [{ title: "asc" }],
    include: {
      courses: { select: { id: true, slug: true, title: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { awards: true, courses: true } },
    },
  });
  return rows.map((b) => ({
    ...serializeBadge(b),
    createdAt: b.createdAt.toISOString(),
    awardCount: b._count.awards,
    courseCount: b._count.courses,
    courses: b.courses,
  }));
}

export async function listAdminCourses(): Promise<AdminCourseBadgeDTO[]> {
  const courses = await prisma.howToCourse.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { badge: true },
  });
  return courses.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    sortOrder: c.sortOrder,
    badgeId: c.badgeId,
    badge: c.badge ? serializeBadge(c.badge) : null,
  }));
}

/** Create a catalog badge (earned when a linked How-to course is completed). */
export async function createBadge(input: {
  title: string;
  description?: string | null;
  emoji?: string | null;
  slug?: string | null;
}): Promise<AdminBadgeDTO> {
  const title = input.title.trim();
  if (title.length < 1 || title.length > 80) {
    throw new BadgeAdminError("Title must be 1–80 characters.");
  }
  const slug = await uniquifyBadgeSlug(input.slug?.trim() || title);
  const emoji = (input.emoji?.trim() || "🏅").slice(0, 16);
  const description = input.description?.trim() || null;
  const created = await prisma.howToBadge.create({
    data: {
      slug,
      title,
      description,
      emoji,
      kind: "howto",
      imageUrl: null,
    },
    include: {
      courses: { select: { id: true, slug: true, title: true } },
      _count: { select: { awards: true, courses: true } },
    },
  });
  return {
    ...serializeBadge(created),
    createdAt: created.createdAt.toISOString(),
    awardCount: created._count.awards,
    courseCount: created._count.courses,
    courses: created.courses,
  };
}

export async function updateBadge(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    emoji?: string | null;
  }
): Promise<AdminBadgeDTO> {
  const existing = await prisma.howToBadge.findUnique({ where: { id } });
  if (!existing) throw new BadgeAdminError("Badge not found.", 404);

  const data: {
    title?: string;
    description?: string | null;
    emoji?: string;
  } = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title.length < 1 || title.length > 80) {
      throw new BadgeAdminError("Title must be 1–80 characters.");
    }
    data.title = title;
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.emoji !== undefined) {
    data.emoji = (input.emoji?.trim() || "🏅").slice(0, 16);
  }

  const updated = await prisma.howToBadge.update({
    where: { id },
    data,
    include: {
      courses: { select: { id: true, slug: true, title: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { awards: true, courses: true } },
    },
  });
  return {
    ...serializeBadge(updated),
    createdAt: updated.createdAt.toISOString(),
    awardCount: updated._count.awards,
    courseCount: updated._count.courses,
    courses: updated.courses,
  };
}

export async function deleteBadge(id: string): Promise<void> {
  const existing = await prisma.howToBadge.findUnique({
    where: { id },
    include: { _count: { select: { courses: true } } },
  });
  if (!existing) throw new BadgeAdminError("Badge not found.", 404);
  if (existing._count.courses > 0) {
    throw new BadgeAdminError(
      "Badge is linked to a How-to course. Unlink the course first.",
      400
    );
  }
  await prisma.howToBadge.delete({ where: { id } });
  await deleteManagedBadgeImage(existing.imageUrl);
}

export async function setBadgeImageFromUpload(
  badgeId: string,
  file: { mime: string | null; size: number; bytes: Buffer }
): Promise<AdminBadgeDTO> {
  const existing = await prisma.howToBadge.findUnique({ where: { id: badgeId } });
  if (!existing) throw new BadgeAdminError("Badge not found.", 404);

  const check = validateBadgeImageUpload({
    mime: file.mime,
    size: file.size,
  });
  if (!check.ok) throw new BadgeAdminError(check.error, 400);

  const imageUrl = await saveBadgeImageFile(file.bytes, check.ext);
  const updated = await prisma.howToBadge.update({
    where: { id: badgeId },
    data: { imageUrl },
    include: {
      courses: { select: { id: true, slug: true, title: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { awards: true, courses: true } },
    },
  });
  await deleteManagedBadgeImage(existing.imageUrl);
  return {
    ...serializeBadge(updated),
    createdAt: updated.createdAt.toISOString(),
    awardCount: updated._count.awards,
    courseCount: updated._count.courses,
    courses: updated.courses,
  };
}

export async function clearBadgeImage(badgeId: string): Promise<AdminBadgeDTO> {
  const existing = await prisma.howToBadge.findUnique({ where: { id: badgeId } });
  if (!existing) throw new BadgeAdminError("Badge not found.", 404);
  const updated = await prisma.howToBadge.update({
    where: { id: badgeId },
    data: { imageUrl: null },
    include: {
      courses: { select: { id: true, slug: true, title: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { awards: true, courses: true } },
    },
  });
  await deleteManagedBadgeImage(existing.imageUrl);
  return {
    ...serializeBadge(updated),
    createdAt: updated.createdAt.toISOString(),
    awardCount: updated._count.awards,
    courseCount: updated._count.courses,
    courses: updated.courses,
  };
}

/** Attach (or clear) which badge a How-to course awards on completion. */
export async function setCourseBadge(
  courseId: string,
  badgeId: string | null
): Promise<AdminCourseBadgeDTO> {
  const course = await prisma.howToCourse.findUnique({ where: { id: courseId } });
  if (!course) throw new BadgeAdminError("Course not found.", 404);
  if (badgeId) {
    const badge = await prisma.howToBadge.findUnique({ where: { id: badgeId } });
    if (!badge) throw new BadgeAdminError("Badge not found.", 404);
  }
  const updated = await prisma.howToCourse.update({
    where: { id: courseId },
    data: { badgeId },
    include: { badge: true },
  });
  return {
    id: updated.id,
    slug: updated.slug,
    title: updated.title,
    sortOrder: updated.sortOrder,
    badgeId: updated.badgeId,
    badge: updated.badge ? serializeBadge(updated.badge) : null,
  };
}

export class BadgeAdminError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BadgeAdminError";
    this.status = status;
  }
}
