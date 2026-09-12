import { HowToHub } from "@/components/HowToHub";

export default function HowToPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-sage-900">How-to</h1>
        <p className="mt-1 text-sm text-sage-600">
          A light cooking basics track — short lessons, mark progress when you
          are signed in, and earn badges when you finish a course.
        </p>
      </div>
      <HowToHub />
    </div>
  );
}
