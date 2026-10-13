import { requireAdminPage } from "@/lib/admin";
import { listSharedProductsForAdmin } from "@/lib/shared-products";
import { AdminProductsPanel } from "@/components/admin/AdminProductsPanel";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdminPage();
  const products = await listSharedProductsForAdmin("");
  return <AdminProductsPanel initial={products} />;
}
