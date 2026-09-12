import { prisma } from "@/lib/db";
import { listUserBadges, type HowToBadgeDTO } from "@/lib/howto";
import { countPendingIncomingForUser } from "@/lib/recipe-request-actions";
import {
  normalizeVisibility,
  type RecipeAccessActor,
} from "@/lib/recipe-visibility";
import {
  defaultProfileSlugBase,
  isValidProfileSlug,
  slugifyProfileBase,
  uniquifySlug,
} from "@/lib/profile-slug";

export type PublicProfileBadge = HowToBadgeDTO & {
  awardedAt: string;
};

export type PublicProfileRecipe = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  visibility: string;
  cookTimeMinutes: number | null;
  costTier: string;
  isStruggleMeal: boolean;
};

export type PublicProfileDTO = {
  id: string;
  displayName: string;
  profileSlug: string;
  badges: PublicProfileBadge[];
  recipes: PublicProfileRecipe[];
};

export type KitchenStripDTO = {
  displayName: string;
  profileSlug: string | null;
  latestBadges: PublicProfileBadge[];
  pendingRequestCount: number;
};

/** Recipes shown on a public profile: owner’s global/public + household (if viewer shares household). */
export function recipeVisibleOnPublicProfile(
  recipe: {
    ownerUserId: string | null;
    visibility: string | null;
    householdId: string | null;
  },
  profileUserId: string,
  viewer: RecipeAccessActor
): boolean {
  if (recipe.ownerUserId !== profileUserId) return false;
  const vis = normalizeVisibility(recipe.visibility);
  if (vis === "global") return true;
  if (vis === "household") {
    return (
      viewer.householdId != null &&
      recipe.householdId != null &&
      viewer.householdId === recipe.householdId
    );
  }
  // shared: not listed on public profile
  return false;
}

export async function ensureUserProfileSlug(user: {
  id: string;
  email: string;
  name: string | null;
  profileSlug: string | null;
}): Promise<string> {
  if (user.profileSlug && isValidProfileSlug(user.profileSlug)) {
    return user.profileSlug;
  }
  const base = defaultProfileSlugBase(user.email, user.name);
  const existing = await prisma.user.findMany({
    where: { profileSlug: { not: null } },
    select: { profileSlug: true },
  });
  const taken = new Set(
    existing.map((u) => u.profileSlug).filter((s): s is string => Boolean(s))
  );
  const slug = uniquifySlug(base, (c) => taken.has(c));
  await prisma.user.update({
    where: { id: user.id },
    data: { profileSlug: slug },
  });
  return slug;
}

export async function allocateProfileSlugForCreate(
  email: string,
  name?: string | null
): Promise<string> {
  const base = defaultProfileSlugBase(email, name);
  const existing = await prisma.user.findMany({
    where: { profileSlug: { not: null } },
    select: { profileSlug: true },
  });
  const taken = new Set(
    existing.map((u) => u.profileSlug).filter((s): s is string => Boolean(s))
  );
  return uniquifySlug(base, (c) => taken.has(c));
}

export async function getPublicProfileBySlug(
  slug: string,
  viewer: RecipeAccessActor
): Promise<PublicProfileDTO | null> {
  const normalized = slugifyProfileBase(slug);
  if (!isValidProfileSlug(normalized)) return null;

  const user = await prisma.user.findUnique({
    where: { profileSlug: normalized },
    select: {
      id: true,
      email: true,
      name: true,
      profileSlug: true,
      disabled: true,
    },
  });
  if (!user || user.disabled || !user.profileSlug) return null;

  const [badges, owned] = await Promise.all([
    listUserBadges(user.id),
    prisma.recipe.findMany({
      where: {
        ownerUserId: user.id,
        visibility: { in: ["global", "public", "household", "private"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        visibility: true,
        cookTimeMinutes: true,
        costTier: true,
        isStruggleMeal: true,
        ownerUserId: true,
        householdId: true,
      },
    }),
  ]);

  const recipes = owned
    .filter((r) =>
      recipeVisibleOnPublicProfile(
        {
          ownerUserId: r.ownerUserId,
          visibility: r.visibility,
          householdId: r.householdId,
        },
        user.id,
        viewer
      )
    )
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      imageUrl: r.imageUrl,
      visibility: normalizeVisibility(r.visibility),
      cookTimeMinutes: r.cookTimeMinutes,
      costTier: r.costTier,
      isStruggleMeal: r.isStruggleMeal,
    }));

  return {
    id: user.id,
    displayName: user.name?.trim() || user.profileSlug,
    profileSlug: user.profileSlug,
    badges: badges.map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      description: b.description,
      emoji: b.emoji,
      imageUrl: b.imageUrl,
      kind: b.kind,
      awardedAt: b.awardedAt,
    })),
    recipes,
  };
}

/** Compact signed-in strip data for the homepage. */
export async function getKitchenStripData(
  userId: string
): Promise<KitchenStripDTO | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      profileSlug: true,
      disabled: true,
    },
  });
  if (!user || user.disabled) return null;

  let profileSlug = user.profileSlug;
  if (!profileSlug) {
    profileSlug = await ensureUserProfileSlug({
      ...user,
      profileSlug: null,
    });
  }

  const [badges, pendingRequestCount] = await Promise.all([
    listUserBadges(user.id),
    countPendingIncomingForUser(user.id),
  ]);

  return {
    displayName: user.name?.trim() || profileSlug,
    profileSlug,
    latestBadges: badges.slice(0, 3).map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      description: b.description,
      emoji: b.emoji,
      imageUrl: b.imageUrl,
      kind: b.kind,
      awardedAt: b.awardedAt,
    })),
    pendingRequestCount,
  };
}

/** Pure helper for tests: pick latest N badges already sorted desc. */
export function pickLatestBadges<T>(badges: T[], limit = 3): T[] {
  return badges.slice(0, Math.max(0, limit));
}
