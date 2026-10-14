// Pure permission rules for Chef's Corner + The Kitchen Table (client-safe).

export type ContentViewer = {
  id: string;
  role: string;
  isChef?: boolean | null;
  chefCanPublish?: boolean | null;
  disabled?: boolean | null;
} | null | undefined;

export type PostLike = {
  authorUserId: string | null;
  status: string;
  publishedAt: Date | string | null;
};

export const POST_STATUSES = ["draft", "review", "scheduled", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
export const POST_KINDS = ["article", "howto", "announcement"] as const;
export const SPONSOR_LABELS = ["Sponsored", "Partner"] as const;

const active = (v: ContentViewer): v is NonNullable<ContentViewer> => Boolean(v && !v.disabled);
export const isAdminViewer = (v: ContentViewer) => active(v) && v.role === "admin";
export const isChefViewer = (v: ContentViewer) => active(v) && Boolean(v.isChef);

/** Live = published or scheduled with its time reached (publishedAt holds the go-live time). */
export function isPostLive(p: PostLike, now: Date = new Date()): boolean {
  if (p.status !== "published" && p.status !== "scheduled") return false;
  if (!p.publishedAt) return false;
  return new Date(p.publishedAt).getTime() <= now.getTime();
}

export function effectiveStatus(p: PostLike, now: Date = new Date()): PostStatus {
  if (p.status === "scheduled" && isPostLive(p, now)) return "published";
  return (POST_STATUSES as readonly string[]).includes(p.status) ? (p.status as PostStatus) : "draft";
}

export function canAuthorPosts(v: ContentViewer): boolean {
  return isAdminViewer(v) || isChefViewer(v);
}

const owns = (v: ContentViewer, p: PostLike) => active(v) && p.authorUserId === v.id;

export function canPublishPost(v: ContentViewer, p: PostLike): boolean {
  if (isAdminViewer(v)) return true;
  return isChefViewer(v) && owns(v, p) && Boolean(v!.chefCanPublish);
}

/** Chefs edit their own posts; without publish rights only while not live/scheduled. */
export function canEditPost(v: ContentViewer, p: PostLike): boolean {
  if (isAdminViewer(v)) return true;
  if (!isChefViewer(v) || !owns(v, p)) return false;
  if (v!.chefCanPublish) return true;
  return p.status === "draft" || p.status === "review";
}

export function canSubmitPost(v: ContentViewer, p: PostLike): boolean {
  return isChefViewer(v) && owns(v, p) && p.status === "draft";
}

export function canDeletePost(v: ContentViewer, p: PostLike): boolean {
  if (isAdminViewer(v)) return true;
  return isChefViewer(v) && owns(v, p) && (p.status === "draft" || p.status === "review");
}

/** Anyone sees live posts; drafts/scheduled only for their author and admins (preview). */
export function canViewPost(v: ContentViewer, p: PostLike, now: Date = new Date()): boolean {
  return isPostLive(p, now) || isAdminViewer(v) || owns(v, p);
}

export function canEditProfile(v: ContentViewer, profile: { userId: string | null }): boolean {
  if (isAdminViewer(v)) return true;
  return isChefViewer(v) && profile.userId === v!.id;
}

/** Only admins may flag/unflag an account as a chef or change its publish toggle. */
export function canSetChefFlag(v: ContentViewer): boolean {
  return isAdminViewer(v);
}
