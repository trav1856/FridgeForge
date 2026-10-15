import { WeeklyMenuView } from "@/components/WeeklyMenuView";
import { MenuModeTabs } from "@/components/diet/MenuModeTabs";
import { DietPlanView } from "@/components/diet/DietPlanView";

export default async function MenuPlannerPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode = (await searchParams).mode === "diet" ? "diet" : "pantry";
  return (
    <div className="space-y-4">
      <MenuModeTabs mode={mode} />
      {mode === "diet" ? <DietPlanView /> : <WeeklyMenuView />}
    </div>
  );
}
