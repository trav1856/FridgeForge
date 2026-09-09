import { AdminUsersPanel } from "@/components/AdminUsersPanel";
import { prisma } from "@/lib/db";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      role: true,
      disabled: true,
      createdAt: true,
      _count: { select: { memberships: true, reviews: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  return (
    <AdminUsersPanel
      initial={users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        role: u.role,
        disabled: u.disabled,
        createdAt: u.createdAt.toISOString(),
        householdCount: u._count.memberships,
        reviewCount: u._count.reviews,
      }))}
    />
  );
}
