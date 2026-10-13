import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { AdminExportPanel } from "@/components/admin/AdminExportPanel";

export const dynamic = "force-dynamic";

export default async function AdminExportPage() {
  await requireAdminPage();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { id: true, email: true, name: true, profileSlug: true },
  });
  return (
    <AdminExportPanel
      users={users.map((u) => ({ id: u.id, label: `${u.name?.trim() || u.profileSlug || "User"} · ${u.email}` }))}
    />
  );
}
