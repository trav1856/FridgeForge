import { StruggleResources } from "@/components/StruggleResources";
import { listPublishedStruggleResources } from "@/lib/struggle-resources";

export default async function StrugglePage() {
  const all = await listPublishedStruggleResources();
  const tips = all.filter((r) => r.kind === "tip");
  const kidsMeals = all.filter((r) => r.kind === "kids_meal");
  return <StruggleResources tips={tips} kidsMeals={kidsMeals} />;
}
