import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/admin-users";
import { contentImagesInHtml, htmlToText, sanitizePostHtml } from "@/lib/content/sanitize";
import { deleteContentImage, isManagedContentImage } from "@/lib/content/images";
import {
  POST_KINDS,
  SPONSOR_LABELS,
  canAuthorPosts,
  canDeletePost,
  canEditPost,
  canPublishPost,
  canSubmitPost,
  canViewPost,
  effectiveStatus,
  isAdminViewer,
  type ContentViewer,
} from "@/lib/content/permissions";
import { ContentError, cleanStringList, parseJsonArray, uniqueSlug } from "@/lib/content/util";

export type PostInput = {
  title?: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  bodyHtml?: string;
  tags?: string[];
  relatedRecipeIds?: string[];
  kind?: string;
  sponsorLabel?: string | null;
  profileId?: string | null;
};

type Viewer = NonNullable<ContentViewer>;
const slugTaken = async (slug: string) => Boolean(await prisma.post.findUnique({ where: { slug }, select: { id: true } }));

/** SQL-side "live" filter matching permissions.isPostLive. */
export function liveWhere(now = new Date()): Prisma.PostWhereInput {
  return { status: { in: ["published", "scheduled"] }, publishedAt: { lte: now } };
}

export function serializePost<T extends { tags: string; relatedRecipeIds: string; status: string; publishedAt: Date | null; authorUserId: string | null }>(p: T, now = new Date()) {
  return {
    ...p,
    tags: parseJsonArray<string>(p.tags),
    relatedRecipeIds: parseJsonArray<string>(p.relatedRecipeIds),
    effectiveStatus: effectiveStatus(p, now),
  };
}

async function cleanInput(actor: Viewer, input: PostInput, current?: { profileId: string | null }) {
  const data: Prisma.PostUncheckedUpdateInput = {};
  if (input.title !== undefined) {
    const t = input.title.replace(/\s+/g, " ").trim().slice(0, 160);
    if (!t) throw new ContentError("Title is required");
    data.title = t;
  }
  if (input.excerpt !== undefined) data.excerpt = (input.excerpt || "").trim().slice(0, 400) || null;
  if (input.coverUrl !== undefined) {
    if (input.coverUrl && !isManagedContentImage(input.coverUrl)) throw new ContentError("Upload the cover photo first");
    data.coverUrl = input.coverUrl || null;
  }
  if (input.bodyHtml !== undefined) data.bodyHtml = sanitizePostHtml(input.bodyHtml);
  if (input.tags !== undefined) data.tags = JSON.stringify(cleanStringList(input.tags, 12, 40).map((t) => t.toLowerCase()));
  if (input.relatedRecipeIds !== undefined) {
    const ids = [...new Set((input.relatedRecipeIds || []).filter((x) => typeof x === "string"))].slice(0, 12);
    const ok = await prisma.recipe.findMany({ where: { id: { in: ids }, visibility: { in: ["global", "public"] } }, select: { id: true } });
    const okSet = new Set(ok.map((r) => r.id));
    data.relatedRecipeIds = JSON.stringify(ids.filter((i) => okSet.has(i)));
  }
  if (input.kind !== undefined) {
    if (!(POST_KINDS as readonly string[]).includes(input.kind)) throw new ContentError("Unknown post type");
    if (input.kind === "announcement" && !isAdminViewer(actor)) throw new ContentError("Only admins post announcements", 403);
    data.kind = input.kind;
  }
  if (input.sponsorLabel !== undefined) {
    if (input.sponsorLabel && !(SPONSOR_LABELS as readonly string[]).includes(input.sponsorLabel)) throw new ContentError("Unknown label");
    data.sponsorLabel = input.sponsorLabel || null;
  }
  if (input.profileId !== undefined) {
    if (isAdminViewer(actor)) {
      if (input.profileId && !(await prisma.featuredProfile.findUnique({ where: { id: input.profileId }, select: { id: true } }))) {
        throw new ContentError("Chef not found");
      }
      data.profileId = input.profileId || null;
    } else if (input.profileId !== (current?.profileId ?? null)) {
      throw new ContentError("Chefs post as themselves", 403);
    }
  }
  return data;
}

export async function createPost(actor: ContentViewer, input: PostInput) {
  if (!canAuthorPosts(actor)) throw new ContentError("Forbidden", 403);
  const a = actor!;
  const own = await prisma.featuredProfile.findUnique({ where: { userId: a.id }, select: { id: true } });
  const data = await cleanInput(a, { ...input, title: input.title || "Untitled post" }, { profileId: own?.id ?? null });
  return prisma.post.create({
    data: {
      ...(data as Prisma.PostUncheckedCreateInput),
      title: String(data.title),
      slug: await uniqueSlug(String(data.title), slugTaken),
      status: "draft",
      authorUserId: a.id,
      profileId: (data.profileId as string | null | undefined) ?? own?.id ?? null,
    },
  });
}

async function load(id: string) {
  const p = await prisma.post.findUnique({ where: { id } });
  if (!p) throw new ContentError("Not found", 404);
  return p;
}

export async function updatePost(actor: ContentViewer, id: string, input: PostInput) {
  const p = await load(id);
  if (!canEditPost(actor, p)) throw new ContentError("Forbidden", 403);
  const data = await cleanInput(actor!, input, p);
  const next = await prisma.post.update({ where: { id }, data });
  // Remove photos no longer referenced by this post (only ever used here).
  const before = [p.coverUrl, ...contentImagesInHtml(p.bodyHtml)];
  const after = new Set([next.coverUrl, ...contentImagesInHtml(next.bodyHtml)]);
  for (const u of before) if (u && !after.has(u)) await deleteIfUnreferenced(u);
  return next;
}

async function deleteIfUnreferenced(url: string) {
  const refs = await prisma.post.count({ where: { OR: [{ coverUrl: url }, { bodyHtml: { contains: url } }] } });
  const prof = await prisma.featuredProfile.count({ where: { photoUrl: url } });
  if (!refs && !prof) await deleteContentImage(url);
}

export async function deletePost(actor: ContentViewer, id: string) {
  const p = await load(id);
  if (!canDeletePost(actor, p)) throw new ContentError("Forbidden", 403);
  await prisma.post.delete({ where: { id } });
  for (const u of [p.coverUrl, ...contentImagesInHtml(p.bodyHtml)]) if (u) await deleteIfUnreferenced(u);
  if (["published", "scheduled"].includes(p.status)) {
    await writeAudit(prisma, { actorId: actor!.id, targetUserId: p.authorUserId, action: "post.unpublish", details: { postId: id, title: p.title, deleted: true } });
  }
}

export type PostAction =
  | { action: "submit" }
  | { action: "publish"; publishAt?: string | null }
  | { action: "unpublish" }
  | { action: "reject"; note?: string | null };

export async function postAction(actor: ContentViewer, id: string, act: PostAction, now = new Date()) {
  const p = await load(id);
  const a = actor!;
  switch (act.action) {
    case "submit": {
      if (!canSubmitPost(actor, p)) throw new ContentError(p.status === "draft" ? "Forbidden" : "Only drafts can be submitted", p.status === "draft" ? 403 : 400);
      if (!p.title.trim() || !htmlToText(p.bodyHtml)) throw new ContentError("Add a title and some text before submitting");
      return prisma.post.update({ where: { id }, data: { status: "review", reviewNote: null } });
    }
    case "publish": {
      if (!canPublishPost(actor, p)) throw new ContentError("Forbidden", 403);
      if (!htmlToText(p.bodyHtml) && !p.coverUrl) throw new ContentError("Add some text before publishing");
      let at = now;
      if (act.publishAt) {
        const d = new Date(act.publishAt);
        if (Number.isNaN(d.getTime())) throw new ContentError("Invalid publish time");
        at = d;
      }
      const scheduled = at.getTime() > now.getTime();
      return prisma.$transaction(async (tx) => {
        const n = await tx.post.update({
          where: { id },
          data: { status: scheduled ? "scheduled" : "published", publishedAt: at, publishAt: scheduled ? at : null, reviewNote: null },
        });
        await writeAudit(tx, {
          actorId: a.id,
          targetUserId: p.authorUserId,
          action: "post.publish",
          details: { postId: id, title: p.title, scheduledFor: scheduled ? at.toISOString() : null, fromStatus: p.status },
        });
        return n;
      });
    }
    case "unpublish": {
      if (!canPublishPost(actor, p)) throw new ContentError("Forbidden", 403);
      if (!["published", "scheduled"].includes(p.status)) return p;
      return prisma.$transaction(async (tx) => {
        const n = await tx.post.update({ where: { id }, data: { status: "draft", publishAt: null, publishedAt: null } });
        await writeAudit(tx, { actorId: a.id, targetUserId: p.authorUserId, action: "post.unpublish", details: { postId: id, title: p.title } });
        return n;
      });
    }
    case "reject": {
      if (!isAdminViewer(actor)) throw new ContentError("Forbidden", 403);
      if (p.status !== "review") throw new ContentError("Only posts in review can be sent back");
      return prisma.$transaction(async (tx) => {
        const n = await tx.post.update({ where: { id }, data: { status: "draft", reviewNote: (act.note || "").trim().slice(0, 1000) || null } });
        await writeAudit(tx, { actorId: a.id, targetUserId: p.authorUserId, action: "post.reject", details: { postId: id, title: p.title } });
        return n;
      });
    }
  }
}

// --- Reads --------------------------------------------------------------------

const cardSelect = {
  id: true, slug: true, kind: true, title: true, excerpt: true, coverUrl: true, tags: true, relatedRecipeIds: true,
  status: true, publishedAt: true, sponsorLabel: true, authorUserId: true,
  profile: { select: { id: true, slug: true, name: true, photoUrl: true, hidden: true } },
} satisfies Prisma.PostSelect;

export async function livePosts(opts: { tag?: string | null; profileId?: string; take?: number } = {}) {
  const rows = await prisma.post.findMany({
    where: {
      ...liveWhere(),
      ...(opts.profileId ? { profileId: opts.profileId } : {}),
      ...(opts.tag ? { tags: { contains: JSON.stringify(opts.tag.toLowerCase()) } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: opts.take ?? 50,
    select: cardSelect,
  });
  return rows.map((r) => serializePost(r));
}

export async function postForViewer(slugOrId: string, viewer: ContentViewer) {
  const p = await prisma.post.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    include: { profile: { select: { id: true, slug: true, name: true, photoUrl: true, hidden: true } } },
  });
  if (!p || !canViewPost(viewer, p)) return null;
  return serializePost(p);
}

export async function myPosts(viewer: Viewer) {
  const rows = await prisma.post.findMany({ where: { authorUserId: viewer.id }, orderBy: { updatedAt: "desc" }, select: { ...cardSelect, updatedAt: true, reviewNote: true } });
  return rows.map((r) => serializePost(r));
}

export async function adminPosts() {
  const rows = await prisma.post.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: { ...cardSelect, updatedAt: true, reviewNote: true, author: { select: { id: true, name: true, profileSlug: true } } },
    take: 300,
  });
  return rows.map((r) => serializePost(r));
}

export async function postForEdit(id: string, viewer: ContentViewer) {
  const p = await prisma.post.findUnique({ where: { id } });
  if (!p || !(canEditPost(viewer, p) || (viewer && p.authorUserId === viewer.id) || isAdminViewer(viewer))) return null;
  return serializePost(p);
}
