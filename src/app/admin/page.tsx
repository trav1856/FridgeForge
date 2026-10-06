import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserStats } from "@/lib/admin-user-stats";
import { MiniBars } from "@/components/admin/MiniBars";

export default async function AdminDashboardPage() {
  const userStats = await getUserStats();
  const signupsThisWeek = userStats.signupsByWeek[userStats.signupsByWeek.length - 1]?.count ?? 0;
  const [
    users,
    admins,
    recipes,
    publicRecipes,
    reviews,
    households,
    pantryItems,
    badges,
    struggleCards,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.recipe.count(),
    prisma.recipe.count({ where: { visibility: { in: ["public", "global"] } } }),
    prisma.recipeReview.count(),
    prisma.household.count(),
    prisma.pantryItem.count(),
    prisma.howToBadge.count(),
    prisma.struggleResource.count(),
  ]);

  const stats = [
    { label: "Users", value: users, href: "/admin/users" },
    { label: "Admins", value: admins, href: "/admin/users" },
    { label: "Recipes", value: recipes, href: "/admin/recipes" },
    { label: "Public recipes", value: publicRecipes, href: "/admin/recipes" },
    { label: "Reviews", value: reviews, href: "/admin/recipes" },
    { label: "Badges", value: badges, href: "/admin/badges" },
    { label: "Struggle cards", value: struggleCards, href: "/admin/struggle" },
    { label: "Households", value: households },
    { label: "Pantry items", value: pantryItems },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-sage-600">
        Manage recipes, users, badges, and Struggle cards. Recipe ratings are available to all
        signed-in cooks — this panel is admin-only.
      </p>
      <Link href="/admin/users" className="card block p-4 hover:opacity-95" data-testid="dashboard-user-activity">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-sage-500">
            Users · sign-ups &amp; activity
          </div>
          <span className="text-xs font-semibold text-ember-700">Manage users →</span>
        </div>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-sage-600">New sign-ups / week</div>
            <div className="flex items-end gap-3">
              <div className="font-display text-3xl font-bold text-sage-900">{signupsThisWeek}</div>
              <MiniBars
                className="flex-1"
                values={userStats.signupsByWeek.map((w) => w.count)}
                labels={userStats.signupsByWeek.map((w) => `Week of ${w.weekStart}`)}
              />
            </div>
            <div className="text-[11px] text-sage-500">This week · last 8 weeks</div>
          </div>
          <div>
            <div className="text-xs text-sage-600">Active users</div>
            <div className="font-display text-3xl font-bold text-sage-900">{userStats.active7}</div>
            <div className="text-[11px] text-sage-500">
              last 7 days · <b className="text-sage-800">{userStats.active30}</b> in 30 days
            </div>
          </div>
          <div>
            <div className="text-xs text-sage-600">Weekly active users</div>
            <MiniBars
              className="mt-1"
              values={userStats.weeklyActive.map((w) => w.count)}
              labels={userStats.weeklyActive.map((w) => `Week of ${w.weekStart}`)}
            />
            <div className="text-[11px] text-sage-500">Distinct users per week · tracking started with this release</div>
          </div>
        </div>
      </Link>
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
