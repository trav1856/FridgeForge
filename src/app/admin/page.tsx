import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function AdminDashboardPage() {
  const [users, admins, recipes, publicRecipes, reviews, households, pantryItems] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "admin" } }),
      prisma.recipe.count(),
      prisma.recipe.count({ where: { visibility: { in: ["public", "global"] } } }),
      prisma.recipeReview.count(),
      prisma.household.count(),
      prisma.pantryItem.count(),
    ]);

  const stats = [
    { label: "Users", value: users, href: "/admin/users" },
    { label: "Admins", value: admins, href: "/admin/users" },
    { label: "Recipes", value: recipes, href: "/admin/recipes" },
    { label: "Public recipes", value: publicRecipes, href: "/admin/recipes" },
    { label: "Reviews", value: reviews, href: "/admin/recipes" },
    { label: "Households", value: households },
    { label: "Pantry items", value: pantryItems },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-sage-600">
        Manage recipes and users. Recipe ratings are available to all signed-in
        cooks — this panel is admin-only.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {stats.map((s) => {
          const inner = (
            <div className="card p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sage-500">
                {s.label}
              </div>
              <div className="mt-1 font-display text-3xl font-bold text-sage-900">
                {s.value}
              </div>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block hover:opacity-90">
              {inner}
            </Link>
          ) : (
            <div key={s.label}>{inner}</div>
          );
        })}
      </div>
      <p className="text-xs text-sage-500">
        Dev tip: Next.js corner indicator is disabled globally in{" "}
        <code className="rounded bg-cream-200 px-1">next.config</code>. Production{" "}
        <code className="rounded bg-cream-200 px-1">next start</code> also has no
        indicator.
      </p>
    </div>
  );
}
