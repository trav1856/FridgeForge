import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/admin-users";
import { isAdminViewer, isPostLive, type ContentViewer } from "@/lib/content/permissions";
import { ContentError } from "@/lib/content/util";

export async function addPin(admin: ContentViewer, kind: "profile" | "post", refId: string) {
  if (!isAdminViewer(admin)) throw new ContentError("Forbidden", 403);
  const exists = await prisma.featuredPin.findFirst({ where: kind === "post" ? { postId: refId } : { profileId: refId } });
  if (exists) return exists;
  if (kind === "post" && !(await prisma.post.findUnique({ where: { id: refId }, select: { id: true } }))) throw new ContentError("Post not found", 404);
  if (kind === "profile" && !(await prisma.featuredProfile.findUnique({ where: { id: refId }, select: { id: true } }))) throw new ContentError("Chef not found", 404);
  const max = await prisma.featuredPin.aggregate({ _max: { position: true } });
  return prisma.$transaction(async (tx) => {
    const pin = await tx.featuredPin.create({
      data: { kind, postId: kind === "post" ? refId : null, profileId: kind === "profile" ? refId : null, position: (max._max.position ?? 0) + 1, createdById: admin!.id },
    });
    // Pinning a chef also counts as featuring them (Chef's Corner top 3).
    if (kind === "profile") await tx.featuredProfile.update({ where: { id: refId }, data: { featuredAt: new Date() } });
    await writeAudit(tx, { actorId: admin!.id, targetUserId: null, action: "pin.add", details: { pinId: pin.id, kind, refId } });
    return pin;
  });
}

export async function removePin(admin: ContentViewer, pinId: string) {
  if (!isAdminViewer(admin)) throw new ContentError("Forbidden", 403);
  const pin = await prisma.featuredPin.findUnique({ where: { id: pinId } });
  if (!pin) throw new ContentError("Not found", 404);
  await prisma.$transaction(async (tx) => {
    await tx.featuredPin.delete({ where: { id: pinId } });
    await writeAudit(tx, { actorId: admin!.id, targetUserId: null, action: "pin.remove", details: { pinId, kind: pin.kind, refId: pin.postId ?? pin.profileId } });
  });
}

export async function movePin(admin: ContentViewer, pinId: string, dir: -1 | 1) {
  if (!isAdminViewer(admin)) throw new ContentError("Forbidden", 403);
  const pins = await prisma.featuredPin.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = pins.findIndex((p) => p.id === pinId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pins.length) return;
  const order = pins.map((p) => p.id);
  [order[i], order[j]] = [order[j]!, order[i]!];
  await prisma.$transaction(order.map((id, k) => prisma.featuredPin.update({ where: { id }, data: { position: k + 1 } })));
}

export type HomePinItem =
  | { pinId: string; kind: "profile"; id: string; slug: string; name: string; photoUrl: string | null; bio: string | null }
  | { pinId: string; kind: "post"; id: string; slug: string; title: string; excerpt: string | null; coverUrl: string | null; sponsorLabel: string | null; postKind: string };

/** Pins visible to the public (live posts, visible chefs) in admin order. */
export async function homePins(): Promise<HomePinItem[]> {
  const pins = await prisma.featuredPin.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { profile: true, post: true },
    take: 24,
  });
  const out: HomePinItem[] = [];
  for (const p of pins) {
    if (p.kind === "profile" && p.profile && !p.profile.hidden) {
      out.push({ pinId: p.id, kind: "profile", id: p.profile.id, slug: p.profile.slug, name: p.profile.name, photoUrl: p.profile.photoUrl, bio: p.profile.bio });
    } else if (p.kind === "post" && p.post && isPostLive(p.post)) {
      out.push({ pinId: p.id, kind: "post", id: p.post.id, slug: p.post.slug, title: p.post.title, excerpt: p.post.excerpt, coverUrl: p.post.coverUrl, sponsorLabel: p.post.sponsorLabel, postKind: p.post.kind });
    }
  }
  return out;
}

export async function adminPins() {
  return prisma.featuredPin.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { profile: { select: { id: true, name: true, slug: true, hidden: true } }, post: { select: { id: true, title: true, slug: true, status: true, publishedAt: true, authorUserId: true } } },
  });
}
