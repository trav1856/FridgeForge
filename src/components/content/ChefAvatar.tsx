/* eslint-disable @next/next/no-img-element */
import { initialsFor } from "@/lib/profile-fields";

export function ChefAvatar({ name, photoUrl, size = "md" }: { name: string; photoUrl: string | null; size?: "sm" | "md" | "lg" | "xl" }) {
  const dim = { sm: "h-10 w-10 text-sm", md: "h-16 w-16 text-lg", lg: "h-24 w-24 text-2xl", xl: "h-32 w-32 text-3xl" }[size];
  return photoUrl ? (
    <img src={photoUrl} alt={name} className={`${dim} shrink-0 rounded-full object-cover ring-4 ring-white shadow-sm`} />
  ) : (
    <div className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ember-200 to-ember-400 font-display font-bold text-white ring-4 ring-white shadow-sm`} aria-hidden>
      {initialsFor(name)}
    </div>
  );
}
