/**
 * One-off: replace auto-generated, email-derived handles with neutral random ones.
 *   npx tsx scripts/retire-email-handles.ts            # dry run (masked report)
 *   npx tsx scripts/retire-email-handles.ts --apply    # apply
 * Prints only masked values. Old slugs are retired (no redirect).
 */
import { PrismaClient } from "@prisma/client";
import { allocateRandomHandle, isAutoSlugFromEmail } from "../src/lib/profile-slug";

const prisma = new PrismaClient();
const mask = (s: string | null) => (s ? `${s[0]}${"*".repeat(Math.max(0, s.length - 2))}${s.length > 1 ? s[s.length - 1] : ""} (${s.length})` : "(none)");
const maskEmail = (e: string) => { const [l, d] = e.split("@"); return `${l![0]}***@${d![0]}***`; };

async function main() {
  const apply = process.argv.includes("--apply");
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, profileSlug: true, role: true, disabled: true }, orderBy: { createdAt: "asc" } });
  const affected = users.filter((u) => !u.profileSlug || isAutoSlugFromEmail(u.profileSlug, u.email, u.name));
  console.log(JSON.stringify({ totalUsers: users.length, affected: affected.length, apply }));
  for (const u of users) {
    const hit = affected.includes(u);
    console.log(JSON.stringify({ id: u.id.slice(0, 6) + "…", email: maskEmail(u.email), role: u.role, disabled: u.disabled, slug: mask(u.profileSlug), emailDerived: hit }));
  }
  if (!apply) return;
  for (const u of affected) {
    const handle = await allocateRandomHandle(async (c) => Boolean(await prisma.user.findUnique({ where: { profileSlug: c }, select: { id: true } })));
    await prisma.user.update({ where: { id: u.id }, data: { profileSlug: handle } });
    console.log(JSON.stringify({ id: u.id.slice(0, 6) + "…", newHandle: handle }));
  }
  const after = await prisma.user.findMany({ select: { email: true, name: true, profileSlug: true } });
  console.log(JSON.stringify({ stillEmailDerived: after.filter((u) => isAutoSlugFromEmail(u.profileSlug, u.email, u.name)).length }));
}
main().finally(() => prisma.$disconnect());
