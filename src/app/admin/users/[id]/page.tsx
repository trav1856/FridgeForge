import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin";
import { AUDIT_LABELS, countActiveAdmins, type AuditAction } from "@/lib/admin-users";
import { fillWeeklyBuckets } from "@/lib/admin-user-stats";
import { avatarTone, fmtDate, fmtDateTime, fmtRelative, initials } from "@/lib/admin-format";
import { parseAllergenList } from "@/lib/allergens";
import { MiniBars } from "@/components/admin/MiniBars";
import { PlanBadge, RoleBadge, StatusBadge } from "@/components/admin/UserBadges";
import { AdminUserActions } from "@/components/admin/AdminUserActions";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

const DIET_LABELS: [string, string][] = [
  ["isJewish", "Jewish"],
  ["isObservant", "Observant"],
  ["preferKosher", "Kosher"],
  ["isMuslim", "Muslim"],
  ["preferHalal", "Halal"],
  ["preferVegetarian", "Vegetarian"],
  ["preferPescatarian", "Pescatarian"],
  ["preferVegan", "Vegan"],
  ["preferCarnivore", "Carnivore"],
  ["preferAtkins", "Atkins"],
  ["preferLowCarb", "Low carb"],
  ["preferLowSugar", "Low sugar"],
  ["preferLowSodium", "Low sodium"],
];

type Activity = { at: Date; icon: string; text: React.ReactNode; key: string };

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        include: {
          household: {
            select: {
              id: true,
              name: true,
              members: {
                orderBy: { createdAt: "asc" },
                select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
              },
              _count: { select: { pantryItems: true, recipes: true } },
            },
          },
        },
      },
      _count: {
        select: {
          ownedRecipes: true,
          cookSessions: { where: { undoneAt: null } },
          favorites: true,
          reviews: true,
          howToBadges: true,
        },
      },
    },
  });
  if (!user) notFound();

  const since12w = new Date(now.getTime() - 12 * 7 * DAY_MS);
  const soleHouseholdIds = user.memberships
    .filter((m) => m.household.members.every((x) => x.user.id === user.id))
    .map((m) => m.householdId);

  const [activeSessions, sessions, cooks, cookWeeks, recipes, reviews, audit, activeAdmins, privateRecipeCounts, disabledBy] =
    await Promise.all([
      prisma.session.count({ where: { userId: id, expiresAt: { gt: now } } }),
      prisma.session.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, createdAt: true } }),
      prisma.recipeCookSession.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, createdAt: true, undoneAt: true, recipe: { select: { title: true } } },
      }),
      prisma.recipeCookSession.findMany({
        where: { userId: id, undoneAt: null, createdAt: { gte: since12w } },
        select: { createdAt: true },
      }),
      prisma.recipe.findMany({
        where: { ownerUserId: id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, title: true, createdAt: true, sourceUrl: true },
      }),
      prisma.recipeReview.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, stars: true, createdAt: true, recipe: { select: { title: true } } },
      }),
      prisma.adminAuditLog.findMany({ where: { targetUserId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
      countActiveAdmins(prisma),
      soleHouseholdIds.length
        ? prisma.recipe.groupBy({
            by: ["householdId"],
            where: { householdId: { in: soleHouseholdIds }, visibility: { notIn: ["global", "public"] } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { householdId: string | null; _count: { _all: number } }[]),
      user.disabledById
        ? prisma.user.findUnique({ where: { id: user.disabledById }, select: { name: true, email: true } })
        : Promise.resolve(null),
    ]);

  const actorIds = [...new Set(audit.map((a) => a.actorId))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const actorName = (aid: string) => {
    const a = actors.find((x) => x.id === aid);
    return a ? a.name || a.email : "Deleted admin";
  };

  const primary = user.memberships[0]?.household ?? null;
  const pantryCount = primary?._count.pantryItems ?? 0;
  const weeks = fillWeeklyBuckets(cookWeeks.map((c) => ({ week: c.createdAt, n: 1 })), 12, now);

  const activity: Activity[] = [
    ...cooks.map((c) => ({
      key: `c${c.id}`,
      at: c.createdAt,
      icon: "🍳",
      text: (
        <>
          Cooked <b>{c.recipe.title}</b>
          {c.undoneAt ? <span className="text-sage-500"> · undone</span> : null}
        </>
      ),
    })),
    ...recipes.map((r) => ({
      key: `r${r.id}`,
      at: r.createdAt,
      icon: "📖",
      text: (
        <>
          {r.sourceUrl ? "Imported" : "Added"} recipe <b>{r.title}</b>
        </>
      ),
    })),
    ...reviews.map((r) => ({
      key: `v${r.id}`,
      at: r.createdAt,
      icon: "⭐",
      text: (
        <>
          Reviewed <b>{r.recipe.title}</b> · {r.stars} stars
        </>
      ),
    })),
    ...sessions.map((s) => ({
      key: `s${s.id}`,
      at: s.createdAt,
      icon: "🔑",
      text: <>Signed in · new session (no IP or device stored)</>,
    })),
  ];
  if (user.lastSignInAt && !sessions.some((s) => Math.abs(s.createdAt.getTime() - user.lastSignInAt!.getTime()) < 5000)) {
    activity.push({ key: "lastsignin", at: user.lastSignInAt, icon: "🔑", text: <>Last sign-in</> });
  }
  activity.sort((a, b) => b.at.getTime() - a.at.getTime());
  const recent = activity.slice(0, 12);

  const isSelf = admin.id === user.id;
  const isLastAdmin = user.role === "admin" && !user.disabled && activeAdmins <= 1;

  const privateBy = new Map(privateRecipeCounts.map((r) => [r.householdId, r._count._all]));
  const deletePreview: string[] = [
    "Removes the account, sessions, favorites, reviews, shopping items, menus, how-to progress & badges",
  ];
  for (const m of user.memberships) {
    const others = m.household.members.filter((x) => x.user.id !== user.id);
    if (others.length === 0) {
      const priv = privateBy.get(m.householdId) ?? 0;
      deletePreview.push(
        `Household “${m.household.name}” has no other members and is deleted with its ${plural(m.household._count.pantryItems, "pantry item")}` +
          (priv ? ` and ${plural(priv, "household-only recipe")} (they would otherwise become public)` : "")
      );
    } else if (m.role === "owner" && !others.some((o) => o.role === "owner")) {
      deletePreview.push(`Household “${m.household.name}” is kept — ${others[0]!.user.name || others[0]!.user.email} becomes owner`);
    } else {
      deletePreview.push(`Household “${m.household.name}” is kept (other members remain)`);
    }
  }
  deletePreview.push(`${plural(user._count.ownedRecipes, "owned recipe")} kept with the owner cleared (unless listed above)`);
  deletePreview.push("Cook history kept anonymously (user unlinked)");

  const diet = DIET_LABELS.filter(([k]) => Boolean((user as unknown as Record<string, unknown>)[k])).map(([, l]) => l);
  const allergens = parseAllergenList(user.allergenFlags);
  const disabledSummary = user.disabled
    ? `Suspended ${user.disabledAt ? fmtDateTime(user.disabledAt) : ""}${disabledBy ? ` by ${disabledBy.name || disabledBy.email}` : ""}`.trim()
    : null;

  const tiles = [
    { label: "Recipes", value: user._count.ownedRecipes },
    { label: "Cooks", value: user._count.cookSessions },
    { label: "Pantry items", value: pantryCount },
    { label: "Favorites", value: user._count.favorites },
    { label: "Reviews", value: user._count.reviews },
    { label: "Badges", value: user._count.howToBadges },
  ];

  return (
    <div className="ff-admin-wide space-y-4" data-testid="user-detail">
      <div className="text-xs">
        <Link href="/admin/users" className="font-semibold text-ember-700 hover:underline">
          ← All users
        </Link>
        <span className="text-sage-500"> / {user.name || user.email}</span>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className={clsx("grid h-14 w-14 flex-none place-items-center rounded-full font-display text-xl font-bold", avatarTone(user.id))}>
            {initials(user.name, user.email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold text-sage-900">{user.name || user.email.split("@")[0]}</h2>
              <RoleBadge role={user.role} />
              <PlanBadge plan={user.plan} />
              <StatusBadge disabled={user.disabled} />
              {isSelf && <span className="badge bg-cream-200 font-semibold text-sage-700">You</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-sage-600">
              <span data-testid="detail-email">{user.email}</span>
              <span>
                Joined <b className="text-sage-900">{fmtDate(user.createdAt)}</b>
              </span>
              <span>
                Last active <b className="text-sage-900">{fmtRelative(user.lastActiveAt, now)}</b>
              </span>
              <span>
                Last sign-in <b className="text-sage-900">{fmtRelative(user.lastSignInAt, now)}</b>
              </span>
              {user.profileSlug && (
                <span>
                  Profile <b className="text-sage-900">/u/{user.profileSlug}</b>
                </span>
              )}
            </div>
          </div>
          {user.profileSlug && (
            <Link href={`/u/${user.profileSlug}`} className="btn-secondary w-full px-3 py-2 text-[13px] sm:w-auto">
              View public profile
            </Link>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 border-t border-cream-200 pt-3 sm:grid-cols-6">
          {tiles.map((t, i) => (
            <div key={t.label} className={clsx("px-3 py-1", i % 3 !== 0 && "border-l border-cream-300", "sm:border-l sm:first:border-l-0")}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-sage-600">{t.label}</div>
              <div className="font-display text-2xl font-bold text-sage-900">{t.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold text-sage-900">Activity</h2>
            <p className="text-xs text-sage-600">Cooks per week · last 12 weeks · undone cooks excluded</p>
            <MiniBars className="mt-3" heightClass="h-20" values={weeks.map((w) => w.count)} labels={weeks.map((w) => `Week of ${w.weekStart}`)} />
            <div className="mt-1 flex justify-between text-[10px] text-sage-500">
              <span>{weeks[0]?.weekStart}</span>
              <span>This week</span>
            </div>
            <h3 className="mt-4 text-[11px] font-bold uppercase tracking-wider text-sage-600">Recent activity</h3>
            {recent.length === 0 ? (
              <p className="mt-2 text-sm text-sage-500">No activity recorded yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-cream-200" data-testid="recent-activity">
                {recent.map((a) => (
                  <li key={a.key} className="flex items-center gap-3 py-2.5 text-sm text-sage-800">
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-cream-200 text-sm" aria-hidden>
                      {a.icon}
                    </span>
                    <span className="min-w-0 flex-1">{a.text}</span>
                    <span className="whitespace-nowrap text-[11px] text-sage-500">{fmtRelative(a.at, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-2 font-display text-lg font-bold text-sage-900">Profile</h2>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-sage-600">Display name</dt>
              <dd className="text-sage-900">{user.name || "—"}</dd>
              <dt className="text-sage-600">Email</dt>
              <dd className="break-all text-sage-900">{user.email}</dd>
              <dt className="text-sage-600">Plan</dt>
              <dd className="text-sage-900">{user.plan === "pro" ? "Premium" : "Free"}</dd>
              <dt className="text-sage-600">Password</dt>
              <dd className="text-sage-900">{user.passwordHash ? "Set" : "Not set"}</dd>
              <dt className="text-sage-600">Dietary prefs</dt>
              <dd className="flex flex-wrap gap-1">
                {diet.length ? diet.map((d) => <span key={d} className="badge bg-sage-100 text-sage-700">{d}</span>) : <span className="text-sage-500">None</span>}
              </dd>
              <dt className="text-sage-600">Allergens</dt>
              <dd className="flex flex-wrap gap-1">
                {allergens.length ? allergens.map((a) => <span key={a} className="badge bg-red-100 text-red-800">{a}</span>) : <span className="text-sage-500">None</span>}
              </dd>
              {user.disabled && (
                <>
                  <dt className="text-sage-600">Suspended</dt>
                  <dd className="text-red-800">
                    {disabledSummary}
                    {user.disabledReason ? ` — ${user.disabledReason}` : ""}
                  </dd>
                </>
              )}
            </dl>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-sage-900">Household</h2>
              {primary && <span className="badge bg-cream-200 font-semibold text-sage-700">{plural(primary.members.length, "member")}</span>}
            </div>
            {user.memberships.length === 0 ? (
              <p className="mt-2 text-sm text-sage-500">Not in a household.</p>
            ) : (
              user.memberships.map((m, i) => (
                <div key={m.id} className={clsx(i > 0 && "mt-4 border-t border-cream-200 pt-3")}>
                  <p className="text-xs text-sage-600">
                    <b className="text-sage-900">{m.household.name}</b>
                    {i === 0 && user.memberships.length > 1 ? " (primary)" : ""} · {plural(m.household._count.pantryItems, "pantry item")} ·{" "}
                    {plural(m.household._count.recipes, "household recipe")}
                  </p>
                  <ul className="mt-1 divide-y divide-cream-200">
                    {m.household.members.map((mem) => (
                      <li key={mem.id} className="flex items-center gap-2.5 py-2">
                        <div className={clsx("grid h-7 w-7 flex-none place-items-center rounded-full text-[11px] font-bold", avatarTone(mem.user.id))}>
                          {initials(mem.user.name, mem.user.email)}
                        </div>
                        <div className="min-w-0 flex-1">
                          {mem.user.id === user.id ? (
                            <span className="text-sm font-semibold text-sage-900">{mem.user.name || mem.user.email}</span>
                          ) : (
                            <Link href={`/admin/users/${mem.user.id}`} className="text-sm font-semibold text-ember-700 hover:underline">
                              {mem.user.name || mem.user.email}
                            </Link>
                          )}
                          <div className="text-[11px] text-sage-500">
                            {mem.user.id === user.id ? "this user" : `joined ${fmtDate(mem.createdAt)}`}
                          </div>
                        </div>
                        <span
                          className={clsx(
                            "badge font-semibold",
                            mem.role === "owner" ? "bg-sage-800 text-cream-50" : "bg-sage-100 text-sage-700"
                          )}
                        >
                          {mem.role === "owner" ? "Owner" : "Member"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          <AdminUserActions
            user={{
              id: user.id,
              email: user.email,
              role: user.role,
              plan: user.plan,
              disabled: user.disabled,
              disabledReason: user.disabledReason,
              disabledSummary,
            }}
            isSelf={isSelf}
            isLastAdmin={isLastAdmin}
            activeSessions={activeSessions}
            deletePreview={deletePreview}
          />

          <section className="card p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-sage-600">Admin audit log</h3>
            {audit.length === 0 ? (
              <p className="mt-2 text-xs text-sage-500">No admin actions yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-dashed divide-cream-300" data-testid="audit-log">
                {audit.map((a) => {
                  const d = (a.details ?? {}) as Record<string, unknown>;
                  const extra =
                    a.action === "user.role" || a.action === "user.plan"
                      ? ` ${String(d.from)} → ${String(d.to)}`
                      : a.action === "user.suspend" && typeof d.reason === "string"
                        ? ` — “${d.reason}”`
                        : a.action === "user.sessions.revoke" && typeof d.sessionsRevoked === "number"
                          ? ` (${d.sessionsRevoked})`
                          : "";
                  return (
                    <li key={a.id} className="py-1.5 text-xs text-sage-700">
                      <b className="text-sage-900">{actorName(a.actorId)}</b>{" "}
                      {AUDIT_LABELS[a.action as AuditAction] ?? a.action}
                      {extra} · <span className="text-sage-500">{fmtDateTime(a.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
