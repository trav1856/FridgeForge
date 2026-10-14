import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentViewer } from "@/lib/content/route-helpers";
import { canEditPost, canPublishPost, isAdminViewer } from "@/lib/content/permissions";
import { postForEdit } from "@/lib/content/posts";
import { PostEditor } from "@/components/content/PostEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit post · FridgeForge" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/account");
  const { id } = await params;
  const post = await postForEdit(id, viewer);
  if (!post) notFound();
  const admin = isAdminViewer(viewer);
  const [recipes, chefs] = await Promise.all([
    prisma.recipe.findMany({ where: { visibility: { in: ["global", "public"] } }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: 500 }),
    admin ? prisma.featuredProfile.findMany({ where: { hidden: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={admin ? "/admin/posts" : "/studio"} className="text-sm font-semibold text-ember-700 hover:underline">← {admin ? "All posts" : "Chef studio"}</Link>
      <PostEditor
        initial={{
          id: post.id, slug: post.slug, kind: post.kind, title: post.title, excerpt: post.excerpt, coverUrl: post.coverUrl,
          bodyHtml: post.bodyHtml, tags: post.tags, relatedRecipeIds: post.relatedRecipeIds, status: post.status,
          effectiveStatus: post.effectiveStatus, publishedAt: post.publishedAt?.toISOString() ?? null,
          sponsorLabel: post.sponsorLabel, profileId: post.profileId, reviewNote: post.reviewNote,
        }}
        caps={{ isAdmin: admin, canPublish: canPublishPost(viewer, post), canEdit: canEditPost(viewer, post) }}
        recipes={recipes}
        chefs={chefs}
      />
    </div>
  );
}
