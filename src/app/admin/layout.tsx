import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin, promoteAdminEmails } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Bootstrap known / env admin emails before gate (non-destructive).
  await promoteAdminEmails().catch(() => 0);
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
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin" className="btn-ghost text-xs">
            Dashboard
          </Link>
          <Link href="/admin/recipes" className="btn-ghost text-xs">
            Recipes
          </Link>
          <Link href="/admin/users" className="btn-ghost text-xs">
            Users
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
