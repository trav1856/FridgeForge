import Link from "next/link";

export default function DietaryLearnMorePage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href="/account"
          className="text-sm font-semibold text-ember-700 hover:underline"
        >
          ← Back to Account
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-sage-900">
          Dietary restrictions
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          How FridgeForge uses religion, food preferences, and plant-based
          options when ranking and filtering recipes.
        </p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Religions vs food preferences
        </h2>
        <p className="text-sm leading-relaxed text-sage-700">
          <strong className="text-sage-900">Jewish</strong> and{" "}
          <strong className="text-sage-900">Muslim</strong> are religions.{" "}
          <strong className="text-sage-900">Prefer Kosher</strong> and{" "}
          <strong className="text-sage-900">Prefer Halal</strong> are food
          preferences. You can keep a religion checked even when the matching
          food preference is off.
        </p>
        <p className="text-sm leading-relaxed text-sage-700">
          Jewish cuisine or origin on a recipe is not the same as being marked
          kosher-eligible (and the reverse is also true).
        </p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Kosher* and Halal* on recipes
        </h2>
        <p className="text-sm leading-relaxed text-sage-700">
          When a recipe shows Kosher* or Halal*, that means it is{" "}
          <em>eligible if you use certified ingredients</em> — not a claim that
          FridgeForge or the recipe author has certified the dish.
        </p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          How filters work
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-sage-700">
          <li>
            Religions stack freely with plant-based preferences.
          </li>
          <li>
            <strong className="text-sage-900">Observant</strong> hard-filters to
            kosher-eligible recipes or ones with a “Make it kosher” note.
          </li>
          <li>
            <strong className="text-sage-900">Muslim</strong> soft-prefers Halal.{" "}
            <strong className="text-sage-900">Prefer Halal</strong> hard-filters.
          </li>
        </ul>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Kosher supersedes Halal
        </h2>
        <p className="text-sm leading-relaxed text-sage-700">
          Kosher (food) supersedes Halal (food): turning on Prefer Kosher or
          Observant clears Prefer Halal. Muslim (religion) can stay checked.
        </p>
        <p className="text-sm leading-relaxed text-sage-700">
          Kosher without alcohol still covers Halal satisfaction on the Halal
          path, so a kosher-eligible recipe without alcohol can count when you
          are following Halal.
        </p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Plant-based priority
        </h2>
        <p className="text-sm leading-relaxed text-sage-700">
          Priority is <strong className="text-sage-900">vegan</strong> &gt;{" "}
          <strong className="text-sage-900">vegetarian</strong> &gt;{" "}
          <strong className="text-sage-900">pescatarian</strong> (one primary).
          Vegan implies vegetarian.
        </p>
        <p className="text-sm leading-relaxed text-sage-700">
          Lists prefer matching recipes; non-matching recipes may still appear
          when an adapt note exists (for example, a vegetarian adapt note on an
          otherwise non-vegetarian dish).
        </p>
      </div>

      <p className="text-center text-sm">
        <Link
          href="/account"
          className="font-semibold text-ember-700 hover:underline"
        >
          ← Back to Account
        </Link>
      </p>
    </div>
  );
}
