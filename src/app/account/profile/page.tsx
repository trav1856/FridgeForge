import type { Metadata } from "next";
import { ProfileEditor } from "@/components/profile/ProfileEditor";

export const metadata: Metadata = { title: "Edit profile · FridgeForge" };

export default function EditProfilePage() {
  return <ProfileEditor />;
}
