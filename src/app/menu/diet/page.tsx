import type { Metadata } from "next";
import { MenuModeTabs } from "@/components/diet/MenuModeTabs";
import { DietSettingsForm } from "@/components/diet/DietSettingsForm";

export const metadata: Metadata = { title: "Diet plan setup · FridgeForge" };

export default function DietSetupPage() {
  return (
    <div className="space-y-4">
      <MenuModeTabs mode="diet" />
      <DietSettingsForm />
    </div>
  );
}
