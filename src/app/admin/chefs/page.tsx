import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { serializeProfile } from "@/lib/content/profiles";
import { AdminChefsPanel } from "@/components/admin/AdminChefsPanel";

export const dynamic = "force-dynamic";

export default async function AdminChefsPage() {
  await requireAdminPage();
  const [rows, recipes, pins] = await Promise.all([
    prisma.featuredProfile.findMany({
      orderBy: [{ hidden: "asc" }, { name: "asc" }],
      include: {
        user: { select: { id: true, name: true, profileSlug: true, chefCanPublish: true } },
        recipes: { select: { id: true } },
        _count: { select: { posts: true } },
      },
    }),
    prisma.recipe.findMany({ where: { visibility: { in: ["global", "public"] } }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: 500 }),
    prisma.featuredPin.findMany({ where: { kind: "profile" }, select: { id: true, profileId: true } }),
  ]);
  const pinned = new Map(pins.map((p) => [p.profileId, p.id]));
  return (
    <AdminChefsPanel
      chefs={rows.map((r) => {
        const s = serializeProfile(r);
        return {
          id: s.id, slug: s.slug, name: s.name, bio: s.bio, photoUrl: s.photoUrl, credentials: s.credentials, links: s.links,
          youtubeUrl: s.youtubeUrl, hidden: s.hidden, featuredAt: s.featuredAt?.toISOString() ?? null,
          account: r.user ? { id: r.user.id, label: r.user.name || r.user.profileSlug || "Account" } : null,
          recipeIds: r.recipes.map((x) => x.id), posts: r._count.posts, pinId: pinned.get(s.id) ?? null,
        };
      })}
      recipes={recipes}
    />
  );
}
