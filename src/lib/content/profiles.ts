import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/admin-users";
import { deleteContentImage, isManagedContentImage } from "@/lib/content/images";
import { canEditProfile, canSetChefFlag, type ContentViewer } from "@/lib/content/permissions";
import {
  ContentError,
  cleanLinks,
  cleanStringList,
  normalizeYoutubeChannel,
  parseJsonArray,
  uniqueSlug,
} from "@/lib/content/util";

export const CHEF_TYPE = "chef";
const PUBLIC_RECIPE = { visibility: { in: ["global", "public"] } };

export type ProfileInput = {
  name?: string;
  bio?: string | null;
  photoUrl?: string | null;
  credentials?: string[];
  links?: { label?: string; url: string }[];
  youtubeUrl?: string | null;
};

function cleanProfileInput(input: ProfileInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const n = input.name.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!n) throw new ContentError("Name is required");
    data.name = n;
  }
  if (input.bio !== undefined) data.bio = (input.bio || "").trim().slice(0, 2000) || null;
  if (input.photoUrl !== undefined) {
    if (input.photoUrl && !isManagedContentImage(input.photoUrl)) throw new ContentError("Upload the photo first");
    data.photoUrl = input.photoUrl || null;
  }
  if (input.credentials !== undefined) data.credentials = JSON.stringify(cleanStringList(input.credentials, 10, 120));
  if (input.links !== undefined) data.links = JSON.stringify(cleanLinks(input.links));
  if (input.youtubeUrl !== undefined) {
    if (input.youtubeUrl && !normalizeYoutubeChannel(input.youtubeUrl)) {
      throw new ContentError("Enter a YouTube channel link like https://www.youtube.com/@yourname");
    }
    data.youtubeUrl = input.youtubeUrl ? normalizeYoutubeChannel(input.youtubeUrl) : null;
  }
  return data;
}

const slugTaken = async (slug: string) => Boolean(await prisma.featuredProfile.findUnique({ where: { slug }, select: { id: true } }));

export function serializeProfile<T extends { credentials: string; links: string }>(p: T) {
  return {
    ...p,
    credentials: parseJsonArray<string>(p.credentials).filter((c) => typeof c === "string"),
    links: cleanLinks(parseJsonArray(p.links)),
  };
}

/** Admin-managed profile (no account). */
export async function createProfile(admin: ContentViewer, input: ProfileInput) {
  if (!canSetChefFlag(admin)) throw new ContentError("Forbidden", 403);
  const data = cleanProfileInput(input);
  if (!data.name) throw new ContentError("Name is required");
  return prisma.featuredProfile.create({
    data: { ...(data as { name: string }), profileType: CHEF_TYPE, slug: await uniqueSlug(String(data.name), slugTaken) },
  });
}

export async function updateProfile(actor: ContentViewer, id: string, input: ProfileInput) {
  const p = await prisma.featuredProfile.findUnique({ where: { id } });
  if (!p) throw new ContentError("Not found", 404);
  if (!canEditProfile(actor, p)) throw new ContentError("Forbidden", 403);
  const data = cleanProfileInput(input);
  const updated = await prisma.featuredProfile.update({ where: { id }, data });
  if (data.photoUrl !== undefined && p.photoUrl && p.photoUrl !== updated.photoUrl) await deleteContentImage(p.photoUrl);
  return updated;
}

/** Admin: delete a profile and its photo (recipes/posts are unlinked by FK SetNull). */
export async function deleteProfile(admin: ContentViewer, id: string) {
  if (!canSetChefFlag(admin)) throw new ContentError("Forbidden", 403);
  const p = await prisma.featuredProfile.findUnique({ where: { id } });
  if (!p) throw new ContentError("Not found", 404);
  if (p.userId) throw new ContentError("This profile belongs to a chef account. Turn off 'Chef account' on the user instead.");
  await prisma.featuredProfile.delete({ where: { id } });
  await deleteContentImage(p.photoUrl);
}

export async function setFeatured(admin: NonNullable<ContentViewer>, id: string, on: boolean) {
  if (!canSetChefFlag(admin)) throw new ContentError("Forbidden", 403);
  return prisma.$transaction(async (tx) => {
    const p = await tx.featuredProfile.update({ where: { id }, data: { featuredAt: on ? new Date() : null } });
    await writeAudit(tx, { actorId: admin.id, targetUserId: p.userId, action: "profile.feature", details: { profileId: id, featured: on } });
    return p;
  });
}

/** Admin-managed profiles: credit public recipes to the profile. */
export async function setProfileRecipes(admin: ContentViewer, id: string, recipeIds: string[]) {
  if (!canSetChefFlag(admin)) throw new ContentError("Forbidden", 403);
  const p = await prisma.featuredProfile.findUnique({ where: { id } });
  if (!p) throw new ContentError("Not found", 404);
  const ids = [...new Set(recipeIds)].slice(0, 200);
  await prisma.$transaction([
    prisma.recipe.updateMany({
      where: { chefProfileId: id, id: { notIn: ids }, ...(p.userId ? { ownerUserId: { not: p.userId } } : {}) },
      data: { chefProfileId: null },
    }),
    prisma.recipe.updateMany({ where: { id: { in: ids }, ...PUBLIC_RECIPE }, data: { chefProfileId: id } }),
  ]);
}

/**
 * Admin-only: flag/unflag an account as a chef. Flagging creates (or un-hides)
 * the chef's own profile and credits their public recipes; unflagging hides the
 * profile (content kept) and removes the badge from their recipes. Audit-logged.
 */
export async function setChefFlag(admin: ContentViewer, targetId: string, isChef: boolean) {
  if (!canSetChefFlag(admin)) throw new ContentError("Forbidden", 403);
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: targetId }, include: { featuredProfile: true } });
    if (!u) throw new ContentError("User not found", 404);
    if (u.isChef === isChef && (!isChef || u.featuredProfile)) return u;
    await tx.user.update({ where: { id: targetId }, data: { isChef } });
    let profileId = u.featuredProfile?.id ?? null;
    if (isChef) {
      if (!u.featuredProfile) {
        const base = u.profileSlug || u.name || "chef";
        let slug = await uniqueSlug(base, async (s) => Boolean(await tx.featuredProfile.findUnique({ where: { slug: s }, select: { id: true } })));
        if (!slug) slug = `chef-${targetId.slice(-6)}`;
        const created = await tx.featuredProfile.create({
          data: { profileType: CHEF_TYPE, slug, name: (u.name || u.profileSlug || "Chef").slice(0, 80), bio: u.bio ?? null, userId: u.id },
        });
        profileId = created.id;
      } else {
        await tx.featuredProfile.update({ where: { id: u.featuredProfile.id }, data: { hidden: false } });
      }
      await tx.recipe.updateMany({ where: { ownerUserId: u.id, ...PUBLIC_RECIPE }, data: { chefProfileId: profileId } });
    } else if (profileId) {
      await tx.featuredProfile.update({ where: { id: profileId }, data: { hidden: true } });
      await tx.recipe.updateMany({ where: { ownerUserId: u.id, chefProfileId: profileId }, data: { chefProfileId: null } });
      await tx.featuredPin.deleteMany({ where: { profileId } });
    }
    await writeAudit(tx, {
      actorId: admin!.id,
      targetUserId: targetId,
      action: "user.chef",
      details: { from: u.isChef, to: isChef, profileId },
    });
    return tx.user.findUniqueOrThrow({ where: { id: targetId } });
  });
}

export async function setChefCanPublish(admin: ContentViewer, targetId: string, on: boolean) {
  if (!canSetChefFlag(admin)) throw new ContentError("Forbidden", 403);
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: targetId } });
    if (!u) throw new ContentError("User not found", 404);
    if (u.chefCanPublish === on) return u;
    const n = await tx.user.update({ where: { id: targetId }, data: { chefCanPublish: on } });
    await writeAudit(tx, { actorId: admin!.id, targetUserId: targetId, action: "user.chef_publish", details: { from: u.chefCanPublish, to: on } });
    return n;
  });
}

/** Chef's own recipes get credited automatically when they're public. */
export async function chefProfileIdForOwner(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isChef: true, featuredProfile: { select: { id: true, hidden: true } } } });
  return u?.isChef && u.featuredProfile && !u.featuredProfile.hidden ? u.featuredProfile.id : null;
}

/** Re-sync one recipe's chef credit after create/edit (owner chef + public visibility). */
export async function syncRecipeChefCredit(recipeId: string) {
  const r = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { ownerUserId: true, visibility: true, chefProfileId: true } });
  if (!r) return;
  const pid = await chefProfileIdForOwner(r.ownerUserId);
  if (!pid) return; // admin-credited recipes keep their manual credit
  const want = ["global", "public"].includes(r.visibility) ? pid : null;
  if (want !== r.chefProfileId) await prisma.recipe.update({ where: { id: recipeId }, data: { chefProfileId: want } });
}

// --- Public reads -------------------------------------------------------------

const visibleChef = { profileType: CHEF_TYPE, hidden: false };

export async function featuredChefs(take = 3) {
  const rows = await prisma.featuredProfile.findMany({ where: { ...visibleChef, featuredAt: { not: null } }, orderBy: { featuredAt: "desc" }, take });
  return rows.map(serializeProfile);
}

/** Everyone who has ever contributed (visible profiles), alphabetical. */
export async function allChefs() {
  const rows = await prisma.featuredProfile.findMany({
    where: visibleChef,
    orderBy: { name: "asc" },
    include: { _count: { select: { recipes: { where: PUBLIC_RECIPE }, posts: true } } },
  });
  return rows.map(serializeProfile);
}

export async function getChef(slugOrId: string, viewer?: ContentViewer) {
  const p = await prisma.featuredProfile.findFirst({ where: { profileType: CHEF_TYPE, OR: [{ slug: slugOrId }, { id: slugOrId }] } });
  if (!p) return null;
  if (p.hidden && !canEditProfile(viewer, p)) return null;
  return serializeProfile(p);
}

export async function chefRecipes(profileId: string) {
  return prisma.recipe.findMany({
    where: { chefProfileId: profileId, ...PUBLIC_RECIPE },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, imageUrl: true, cookTimeMinutes: true, costTier: true },
    take: 60,
  });
}
