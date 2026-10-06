import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  AuthError,
  getCurrentUser,
  type AuthUser,
} from "@/lib/auth";

/** Built-in owner emails promoted to admin when present in DB. */
export const DEFAULT_ADMIN_EMAILS = [
  "trav1856@gmail.com",
];

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "admin";
}

/** Parse FF_ADMIN_EMAILS comma-list + built-in owner emails. */
export function adminBootstrapEmails(): string[] {
  const fromEnv = (process.env.FF_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const set = new Set<string>([
    ...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...fromEnv,
  ]);
  return [...set];
}

/**
 * Non-destructive: ensure listed emails have role=admin.
 * Unconditional — use ensureBootstrapAdmin() from request paths / seed.
 */
export async function promoteAdminEmails(
  emails: string[] = adminBootstrapEmails()
): Promise<number> {
  if (!emails.length) return 0;
  const result = await prisma.user.updateMany({
    where: {
      email: { in: emails.map((e) => e.toLowerCase()) },
      role: { not: "admin" },
    },
    data: { role: "admin" },
  });
  return result.count;
}

/**
 * Bootstrap only: promote the built-in / env admin emails when NO admin exists
 * at all (fresh install, or every admin was removed directly in the DB).
 * Once any admin exists this is a single cheap count and never re-promotes, so
 * demoting a bootstrap email from /admin/users sticks.
 */
export async function ensureBootstrapAdmin(
  emails: string[] = adminBootstrapEmails()
): Promise<number> {
  if (!emails.length) return 0;
  const admins = await prisma.user.count({ where: { role: "admin" } });
  if (admins > 0) return 0;
  return promoteAdminEmails(emails);
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  if (user.disabled) throw new ForbiddenError("Account disabled");
  if (!isAdmin(user)) throw new ForbiddenError();
  return user;
}

/** Server-component gate for admin pages (in addition to the /admin layout). */
export async function requireAdminPage(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  if (!isAdmin(user)) redirect("/");
  return user;
}

export function adminErrorResponse(err: unknown): Response | null {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ForbiddenError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  return null;
}
