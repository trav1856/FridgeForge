import { AdminBadgesPanel } from "@/components/AdminBadgesPanel";
import { listAdminBadges, listAdminCourses } from "@/lib/badges-admin";

export default async function AdminBadgesPage() {
  const [badges, courses] = await Promise.all([
    listAdminBadges(),
    listAdminCourses(),
  ]);
  return (
    <AdminBadgesPanel initialBadges={badges} initialCourses={courses} />
  );
}
