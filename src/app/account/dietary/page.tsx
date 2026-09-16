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
          Dietary preferences & allergies
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          FridgeForge is cuisine-first and religion-agnostic in public browse.
          Kosher, Halal, and allergen guidance are personal — only you see them.
        </p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Cuisine-public, not religion silos
        </h2>
        <p className="text-sm leading-relaxed text-sage-700">
          Recipes are organized by <strong className="text-sage-900">cuisine</strong>{" "}
          (Mediterranean, Middle Eastern, Chinese, Japanese, Korean, Italian,
          Mexican, American, and more). There are no public Kosher / Halal /
          Jewish / Muslim browse silos or nav links.
        </p>
        <p className="text-sm leading-relaxed text-sage-700">
          Jewish cuisine or origin on a recipe is not the same as being marked
          kosher-eligible (and the reverse is also true).
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
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Personal Kosher / Halal warnings
        </h2>
        <p className="text-sm leading-relaxed text-sage-700">
          When you have Prefer Kosher, Observant, Prefer Halal, or the Muslim
          soft path, FridgeForge may show you private badges, “not kosher/halal”
          notes, adapt hints, and similar eligible recipes. Guests and users
          without those prefs do not see that chrome.
        </p>
        <p className="text-sm leading-relaxed text-sage-700">
          Kosher* / Halal* on a recipe (when shown to you) means{" "}
          <em>eligible if you use certified ingredients</em> — not a
          certification claim.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-sage-700">
          <li>
            Prefer Kosher, Observant, Prefer Halal, and Muslim soft-prefer{" "}
            <strong className="text-sage-900">soft-boost</strong> matching
            recipes — they do <em>not</em> hard-hide non-matching recipes in
            Cook Now / Weekly / suggestions.
          </li>
          <li>
            Plant and macro prefs (vegan, carnivore, low carb, etc.) still
            hard-filter as before.
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
          path.
        </p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Allergies
        </h2>
        <p className="text-sm leading-relaxed text-sage-700">
          Allergen flags on Account are <strong className="text-sage-900">personal</strong>.
          Recipes may list common allergen tags (from ingredients or admin). If a
          recipe conflicts with your flags, you get a private allergy warning —
          the recipe is still shown so you can decide.
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
          Vegan implies vegetarian. Lists prefer matching recipes; non-matching
          recipes may still appear when an adapt note exists.
        </p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Macro / lifestyle restrictions
        </h2>
        <p className="text-sm leading-relaxed text-sage-700">
          Carnivore, Atkins, low carb, low sugar, and low sodium are stackable
          and still hard-filter when on. Carnivore is mutually exclusive with
          plant-based. Atkins does not auto-enable low carb. Naming:{" "}
          <strong className="text-sage-900">low sodium</strong> (not “low salt”).
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
