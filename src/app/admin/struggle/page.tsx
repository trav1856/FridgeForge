import { AdminStrugglePanel } from "@/components/AdminStrugglePanel";
import { listAdminStruggleResources } from "@/lib/struggle-resources";

export default async function AdminStrugglePage() {
  const resources = await listAdminStruggleResources();
  return <AdminStrugglePanel initial={resources} />;
}
