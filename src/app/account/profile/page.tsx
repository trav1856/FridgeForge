import type { Metadata } from "next";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { PrivateDetails } from "@/components/profile/PrivateDetails";
import { MyTaste } from "@/components/profile/MyTaste";

export const metadata: Metadata = { title: "Edit profile · FridgeForge" };

export default function EditProfilePage() {
  return (
    <div className="space-y-6">
      <ProfileEditor />
      <MyTaste />
      <PrivateDetails />
    </div>
  );
}
