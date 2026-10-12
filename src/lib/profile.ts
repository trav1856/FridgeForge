/**
 * Public profile (Stage 1): fields, pins and the page/JSON payload.
 *
 * Privacy rule: everything sent to a non-owner goes through the explicit
 * allow-lists below. Email, allergens, diet/religion prefs, household, pantry,
 * plan and role are never read into these payloads.
 */
import { prisma } from "@/lib/db";
import { getPublicProfileBySlug, type PublicProfileDTO } from "@/lib/public-profile";
import { canViewRecipe, type RecipeAccessActor } from "@/lib/recipe-visibility";
import { slugifyProfileBase, isValidProfileSlug } from "@/lib/profile-slug";
import { isSafeSocialUrl } from "@/lib/profile-fields";
import { isManagedProfileImagePath } from "@/lib/profile-images";

export const PIN_KINDS = ["own", "favorite"] as const;
export type PinKind = (typeof PIN_KINDS)[number];
export const MAX_PINS_PER_KIND = 3;

/** The ONLY user columns a public profile payload may contain. */
export const PUBLIC_PROFILE_FIELDS = [
  "displayName",
  "handle",
  "bio",
  "avatarUrl",
  "bannerUrl",
  "socialX",
  "socialFacebook",
] as const;
export type PublicProfileFields = {
  displayName: string;
  handle: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  socialX: string | null;
  socialFacebook: string | null;
};

/** Prisma select for profile rows: nothing private is even loaded. */
export const PROFILE_USER_SELECT = {
  id: true,
  name: true,
  profileSlug: true,
  bio: true,
  avatarUrl: true,
  bannerUrl: true,
  socialX: true,
  socialFacebook: true,
  profilePublic: true,
  disabled: true,
} as const;

type ProfileRow = {
  name: string | null;
  profileSlug: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  socialX?: string | null;
  socialFacebook?: string | null;
};

/** Pure allow-list mapper. Extra keys on `user` (email, allergenFlags, …) are dropped. */
export function toPublicProfileFields(user: ProfileRow): PublicProfileFields {
  const handle = user.profileSlug ?? "";
  return {
    displayName: user.name?.trim() || handle,
    handle,
    bio: user.bio ?? null,
    avatarUrl: isManagedProfileImagePath(user.avatarUrl) ? user.avatarUrl : null,
    bannerUrl: isManagedProfileImagePath(user.bannerUrl) ? user.bannerUrl : null,
    socialX: isSafeSocialUrl(user.socialX) ? user.socialX : null,
    socialFacebook: isSafeSocialUrl(user.socialFacebook) ? user.socialFacebook : null,
  };
}

export type PinnedRecipeCard = {
  id: string;
  title: string;
  imageUrl: string | null;
  cookTimeMinutes: number | null;
  servings: number;
  /** Favorites only. `handle` is set only when the author's profile is public. */
  author: { displayName: string; handle: string | null } | null;
};

export type ProfilePageData =
  | { kind: "private"; isOwner: false; handle: string }
  | {
      kind: "public";
      isOwner: boolean;
      isPrivate: boolean;
      profile: PublicProfileFields;
      ownPins: PinnedRecipeCard[];
      favoritePins: PinnedRecipeCard[];
      badges: PublicProfileDTO["badges"];
      recipes: PublicProfileDTO["recipes"];
    };

const PIN_RECIPE_SELECT = {
  id: true,
  title: true,
  imageUrl: true,
  cookTimeMinutes: true,
  servings: true,
  visibility: true,
  householdId: true,
  ownerUserId: true,
  shares: { select: { toUserId: true, toUserEmail: true, toHouseholdId: true } },
  owner: { select: { name: true, profileSlug: true, profilePublic: true, disabled: true } },
} as const;

type PinRow = {
  kind: string;
  position: number;
  recipe: {
    id: string;
    title: string;
    imageUrl: string | null;
    cookTimeMinutes: number | null;
    servings: number;
    visibility: string | null;
    householdId: string | null;
    ownerUserId: string | null;
    shares: { toUserId: string | null; toUserEmail: string | null; toHouseholdId: string | null }[];
    owner: { name: string | null; profileSlug: string | null; profilePublic: boolean; disabled: boolean } | null;
  };
};

function authorOf(r: PinRow["recipe"]): PinnedRecipeCard["author"] {
  if (!r.ownerUserId || !r.owner) return { displayName: "FridgeForge kitchen", handle: null };
  if (r.owner.disabled) return { displayName: "A FridgeForge cook", handle: null };
  const name = r.owner.name?.trim() || r.owner.profileSlug || "A FridgeForge cook";
  return { displayName: name, handle: r.owner.profilePublic ? r.owner.profileSlug : null };
}

/** Pure: which pins a viewer may see, in order, as cards. */
export function visiblePinCards(
  pins: PinRow[],
  profileUserId: string,
  viewer: RecipeAccessActor
): { own: PinnedRecipeCard[]; favorite: PinnedRecipeCard[] } {
  const out = { own: [] as PinnedRecipeCard[], favorite: [] as PinnedRecipeCard[] };
  for (const p of [...pins].sort((a, b) => a.position - b.position)) {
    const r = p.recipe;
    if (!canViewRecipe(r, viewer)) continue;
    const base = {
      id: r.id,
      title: r.title,
      imageUrl: r.imageUrl,
      cookTimeMinutes: r.cookTimeMinutes,
      servings: r.servings,
    };
    if (p.kind === "own" && r.ownerUserId === profileUserId) {
      if (out.own.length < MAX_PINS_PER_KIND) out.own.push({ ...base, author: null });
    } else if (p.kind === "favorite" && r.ownerUserId !== profileUserId) {
      if (out.favorite.length < MAX_PINS_PER_KIND) out.favorite.push({ ...base, author: authorOf(r) });
    }
  }
  return out;
}

export async function getProfilePageData(
  rawHandle: string,
  viewer: RecipeAccessActor
): Promise<ProfilePageData | null> {
  const handle = slugifyProfileBase(rawHandle);
  if (!isValidProfileSlug(handle)) return null;
  const user = await prisma.user.findUnique({
    where: { profileSlug: handle },
    select: PROFILE_USER_SELECT,
  });
  if (!user || user.disabled || !user.profileSlug) return null;
  const isOwner = Boolean(viewer.userId && viewer.userId === user.id);
  const fields = toPublicProfileFields(user);
  if (!user.profilePublic && !isOwner) {
    return { kind: "private", isOwner: false, handle: fields.handle };
  }
  const [base, pins] = await Promise.all([
    getPublicProfileBySlug(handle, viewer),
    prisma.profilePin.findMany({
      where: { userId: user.id },
      orderBy: [{ kind: "asc" }, { position: "asc" }],
      select: { kind: true, position: true, recipe: { select: PIN_RECIPE_SELECT } },
    }),
  ]);
  const cards = visiblePinCards(pins as PinRow[], user.id, viewer);
  return {
    kind: "public",
    isOwner,
    isPrivate: !user.profilePublic,
    profile: fields,
    ownPins: cards.own,
    favoritePins: cards.favorite,
    badges: base?.badges ?? [],
    recipes: base?.recipes ?? [],
  };
}

/* ------------------------------ owner side ------------------------------ */

export type PinCandidate = {
  id: string;
  title: string;
  imageUrl: string | null;
  visibility: string;
  authorName: string | null;
};

/** Owner's editable profile + the recipes they may pin. Caller must pass the signed-in user's id. */
export async function getOwnerProfile(userId: string) {
  const [user, pins, own, favs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { ...PROFILE_USER_SELECT, ageConfirmedAt: true },
    }),
    prisma.profilePin.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      select: { kind: true, recipeId: true },
    }),
    prisma.recipe.findMany({
      where: { ownerUserId: userId },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { id: true, title: true, imageUrl: true, visibility: true },
    }),
    prisma.recipeFavorite.findMany({
      where: { userId, recipe: { OR: [{ ownerUserId: null }, { ownerUserId: { not: userId } }] } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        recipe: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            visibility: true,
            owner: { select: { name: true, profileSlug: true, disabled: true } },
            ownerUserId: true,
          },
        },
      },
    }),
  ]);
  if (!user) return null;
  return {
    profile: toPublicProfileFields(user),
    profilePublic: user.profilePublic,
    ageConfirmed: Boolean(user.ageConfirmedAt),
    pins: {
      own: pins.filter((p) => p.kind === "own").map((p) => p.recipeId),
      favorite: pins.filter((p) => p.kind === "favorite").map((p) => p.recipeId),
    },
    candidates: {
      own: own.map<PinCandidate>((r) => ({
        id: r.id,
        title: r.title,
        imageUrl: r.imageUrl,
        visibility: r.visibility,
        authorName: null,
      })),
      favorite: favs.map<PinCandidate>(({ recipe: r }) => ({
        id: r.id,
        title: r.title,
        imageUrl: r.imageUrl,
        visibility: r.visibility,
        authorName: !r.ownerUserId
          ? "FridgeForge kitchen"
          : r.owner && !r.owner.disabled
            ? r.owner.name?.trim() || r.owner.profileSlug
            : "A FridgeForge cook",
      })),
    },
  };
}

export type PinValidation =
  | { ok: true; own: string[]; favorite: string[] }
  | { ok: false; error: string };

/** Pure shape check for a pins payload (ownership is checked against the DB separately). */
export function validatePinsShape(input: { own?: unknown; favorite?: unknown }): PinValidation {
  const norm = (v: unknown): string[] | null => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !x || x.length > 64)) return null;
    return v as string[];
  };
  const own = norm(input.own);
  const favorite = norm(input.favorite);
  if (!own || !favorite) return { ok: false, error: "Pins must be lists of recipe ids." };
  if (own.length > MAX_PINS_PER_KIND || favorite.length > MAX_PINS_PER_KIND) {
    return { ok: false, error: `Pin up to ${MAX_PINS_PER_KIND} recipes in each list.` };
  }
  if (new Set(own).size !== own.length || new Set(favorite).size !== favorite.length) {
    return { ok: false, error: "A recipe can only be pinned once per list." };
  }
  return { ok: true, own, favorite };
}

/** Replace a user's pins after checking ownership/favorite rules. Returns an error string or null. */
export async function savePins(userId: string, own: string[], favorite: string[]): Promise<string | null> {
  if (own.length) {
    const n = await prisma.recipe.count({ where: { id: { in: own }, ownerUserId: userId } });
    if (n !== own.length) return "You can only pin your own recipes in My top 3.";
  }
  if (favorite.length) {
    const n = await prisma.recipeFavorite.count({
      where: {
        userId,
        recipeId: { in: favorite },
        recipe: { OR: [{ ownerUserId: null }, { ownerUserId: { not: userId } }] },
      },
    });
    if (n !== favorite.length) {
      return "Favorites must be recipes by other cooks that you've saved as favorites.";
    }
  }
  await prisma.$transaction([
    prisma.profilePin.deleteMany({ where: { userId } }),
    prisma.profilePin.createMany({
      data: [
        ...own.map((recipeId, i) => ({ userId, recipeId, kind: "own", position: i + 1 })),
        ...favorite.map((recipeId, i) => ({ userId, recipeId, kind: "favorite", position: i + 1 })),
      ],
    }),
  ]);
  return null;
}
