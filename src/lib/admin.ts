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
 * Safe to call from seed or admin layout.
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

export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  if (user.disabled) throw new ForbiddenError("Account disabled");
  if (!isAdmin(user)) throw new ForbiddenError();
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
