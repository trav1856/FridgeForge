import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ensureBootstrapAdmin, isAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/recipes", label: "Recipes" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/badges", label: "Badges" },
  { href: "/admin/struggle", label: "Struggle" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Bootstrap known / env admin emails only while no admin exists at all.
  await ensureBootstrapAdmin().catch(() => 0);
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  if (!isAdmin(user)) {
    redirect("/");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ember-700">
            Admin
          </p>
          <h1 className="font-display text-2xl font-bold text-sage-900">
            Site ops
          </h1>
        </div>
        <AdminNav links={ADMIN_LINKS} />
      </div>
      {children}
    </div>
  );
}
