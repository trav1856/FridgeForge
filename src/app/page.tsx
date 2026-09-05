import Link from "next/link";
import { StruggleBanner } from "@/components/StruggleBanner";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <StruggleBanner />

      <section className="overflow-hidden rounded-3xl border border-cream-300 bg-gradient-to-br from-cream-50 via-white to-ember-50 p-6 shadow-card sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">
          FridgeForge MVP
        </p>
        <h1 className="mt-2 max-w-xl font-display text-4xl font-bold leading-tight text-sage-900 sm:text-5xl">
          Great food from what&apos;s already in your kitchen.
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-sage-700 sm:text-lg">
          Track your pantry, save recipes, and get smart suggestions — especially
          when money is tight. Struggle Meal mode turns rice, beans, eggs, and
          canned goods into proud plates.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/suggestions" className="btn-primary">
            Suggest meals
          </Link>
          <Link href="/pantry" className="btn-secondary">
            Open pantry
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            href: "/pantry",
            title: "Pantry",
            body: "CRUD, barcode scan, and receipt bulk-add for staples you already own.",
            icon: "🫙",
          },
          {
            href: "/recipes",
            title: "Recipes",
            body: "Add by hand or import from a URL. Seeded with struggle meals and weeknight winners.",
            icon: "📖",
          },
          {
            href: "/suggestions",
            title: "Cook Now",
            body: "Match pantry to recipes. Near-misses suggest 1–2 cheap staples to pick up.",
            icon: "✨",
          },
          {
            href: "/coupons",
            title: "Coupons",
            body: "Clip sample manufacturer offers and open a bright, scannable redeem view.",
            icon: "🎟️",
          },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card group p-5 transition hover:shadow-card-hover"
          >
            <div className="text-2xl">{c.icon}</div>
            <h2 className="mt-2 font-display text-xl font-bold text-sage-900 group-hover:text-ember-700">
              {c.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-sage-600">{c.body}</p>
          </Link>
        ))}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold text-sage-900">
          Flavor on a budget
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-sage-700">
          Cheap boosters that punch above their price: soy sauce, vinegar, chili
          flakes, garlic, citrus, toasted spices. Technique matters — brown food
          for flavor, salt in layers, finish with acid.
        </p>
      </section>
    </div>
  );
}
