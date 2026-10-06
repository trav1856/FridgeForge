import Image from "next/image";
import Link from "next/link";
import { SplashAuthCard } from "./SplashAuthCard";
import { SplashAuthLink } from "./SplashAuthLink";

const GLOW = "shadow-[0_12px_40px_rgba(234,88,12,0.18)]";
const PILL =
  "inline-flex items-center rounded-full border border-sage-200 bg-white/80 px-3 py-1 text-xs font-medium text-sage-700";
const FEATURE_ICON =
  "flex h-11 w-11 items-center justify-center rounded-[0.875rem] border border-ember-200 bg-gradient-to-br from-ember-50 to-ember-100 text-xl text-ember-700";
const FEATURE_IMG_SIZES = "(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw";

/**
 * Signed-out landing for "/". Rendered by app/page.tsx only when there is no
 * session, so the decision is made on the server (no hydration flip).
 * The root layout's app Nav/main wrapper are hidden via `.ff-splash` in globals.css.
 */
export function Splash() {
  return (
    <div className="ff-splash">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-cream-300/70 bg-cream-50/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="FridgeForge"
              width={36}
              height={36}
              priority
              className="h-9 w-9 shrink-0 rounded-xl shadow-sm"
            />
            <div className="min-w-0">
              <div className="font-display text-lg font-bold leading-tight text-sage-900 group-hover:text-ember-700">
                FridgeForge
              </div>
              <div className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-sage-500">
                Cook what you have
              </div>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Splash">
            <a href="#features" className="btn-ghost rounded-full px-3 py-1.5 text-sm">
              Features
            </a>
            <SplashAuthLink
              mode="signin"
              className="btn-primary rounded-full px-4 py-1.5 text-sm"
            >
              Sign in
            </SplashAuthLink>
          </nav>
          <SplashAuthLink
            mode="signin"
            className="btn-primary rounded-full px-3.5 py-1.5 text-xs sm:hidden"
          >
            Sign in
          </SplashAuthLink>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-cream-300/60">
        <Image
          src="/splash/hero-food.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[center_20%] md:object-right"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(250,246,240,0.94)_0%,rgba(250,246,240,0.88)_48%,rgba(250,246,240,0.78)_100%)] md:bg-[linear-gradient(105deg,rgba(250,246,240,0.97)_0%,rgba(250,246,240,0.88)_42%,rgba(250,246,240,0.35)_68%,rgba(250,246,240,0.15)_100%)]"
        />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-12 lg:items-center lg:gap-12 lg:py-16">
          <div className="lg:col-span-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">
              Recipe + pantry, built around your kitchen
            </p>
            {/* lg:max-w-2xl keeps the headline on two lines with real Fraunces metrics */}
            <h1 className="mt-3 max-w-xl font-display text-4xl font-bold leading-[1.12] text-sage-900 sm:text-5xl lg:max-w-2xl lg:text-[3.25rem]">
              Great food from what&rsquo;s already in your fridge.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-sage-700 sm:text-lg">
              FridgeForge matches your pantry to recipes, builds weekly menus you
              can Remix, and keeps shopping lists, deals, and budget-friendly
              Struggle Mode in one warm place.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <SplashAuthLink
                mode="signup"
                className={`btn-primary px-5 py-3 text-sm ${GLOW}`}
              >
                Get started free
              </SplashAuthLink>
              <Link href="/recipes" className="btn-secondary px-5 py-3 text-sm">
                See what it does
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              <span className={`${PILL} gap-1.5`}>
                <span className="rounded-full bg-gradient-to-br from-ember-600 to-ember-700 px-[0.55rem] py-[0.2rem] text-[0.7rem] font-bold tracking-[0.02em] text-white">
                  92%
                </span>
                Cook Now match
              </span>
              <span className={PILL}>Weekly menu + Remix</span>
              <span className={PILL}>Struggle Mode</span>
            </div>
          </div>

          {/* Auth panel */}
          <div id="auth" className="scroll-mt-24 lg:col-span-5">
            <SplashAuthCard />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">
            Built for real kitchens
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-sage-900 sm:text-4xl">
            Everything between &ldquo;what&rsquo;s for dinner?&rdquo; and plated.
          </h2>
          <p className="mt-3 text-base text-sage-600">
            Start from what you already own. FridgeForge fills the gaps — not the
            other way around.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cook Now */}
          <article className="card group overflow-hidden transition hover:shadow-card-hover">
            <div className="relative h-36 overflow-hidden bg-ember-50">
              <Image
                src="/splash/feature-cook.jpg"
                alt="Plated meal"
                fill
                sizes={FEATURE_IMG_SIZES}
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-5">
              <div className={FEATURE_ICON} aria-hidden>
                ✨
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-sage-900 group-hover:text-ember-700">
                Cook Now
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-sage-600">
                Suggestions ranked by pantry{" "}
                <strong className="font-semibold text-sage-800">% match</strong>.
                Near-misses tip you toward one or two cheap staples.
              </p>
            </div>
          </article>

          {/* Weekly menu */}
          <article className="card group overflow-hidden transition hover:shadow-card-hover">
            <div className="flex h-36 items-end bg-gradient-to-br from-sage-100 via-cream-100 to-ember-50 px-5 pb-4">
              <div className="flex w-full items-center justify-between">
                <div className="rounded-xl border border-cream-300/80 bg-white/90 px-3 py-2 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sage-500">
                    This week
                  </div>
                  <div className="mt-1 flex gap-1" aria-hidden>
                    <span className="h-6 w-6 rounded-md bg-ember-100 text-center text-[10px] font-bold leading-6 text-ember-700">M</span>
                    <span className="h-6 w-6 rounded-md bg-sage-200 text-center text-[10px] font-bold leading-6 text-sage-700">T</span>
                    <span className="h-6 w-6 rounded-md bg-ember-500 text-center text-[10px] font-bold leading-6 text-white">W</span>
                    <span className="h-6 w-6 rounded-md bg-sage-100 text-center text-[10px] font-bold leading-6 text-sage-600">T</span>
                    <span className="h-6 w-6 rounded-md bg-sage-100 text-center text-[10px] font-bold leading-6 text-sage-600">F</span>
                  </div>
                </div>
                <span className="rounded-full border border-ember-200 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ember-700 shadow-sm">
                  Remix
                </span>
              </div>
            </div>
            <div className="p-5">
              <div className={FEATURE_ICON} aria-hidden>
                📅
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-sage-900 group-hover:text-ember-700">
                Weekly menus + Remix
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-sage-600">
                Plan breakfast, lunch, and dinner for the week from your pantry —
                then Remix when plans change.
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-sage-600">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-ember-500" /> Shopping
                  lists that follow the plan
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-ember-500" /> Coupons
                  &amp; deals when ingredients are missing
                </li>
              </ul>
            </div>
          </article>

          {/* Struggle Mode */}
          <article className="card group overflow-hidden transition hover:shadow-card-hover">
            <div className="flex h-36 flex-col justify-end bg-gradient-to-br from-ember-600 via-ember-500 to-ember-700 px-5 pb-4 text-white">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ember-100">
                When money is tight
              </div>
              <div className="mt-1 font-display text-2xl font-bold leading-tight">
                Proud plates
                <br />
                from staples
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Rice", "Beans", "Eggs", "Pasta"].map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-5">
              <div className={FEATURE_ICON} aria-hidden>
                🫙
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-sage-900 group-hover:text-ember-700">
                Struggle Mode
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-sage-600">
                Tight week? Prioritize rice, beans, eggs, pasta, and canned goods —
                turned into food you&rsquo;re proud to plate.
              </p>
              <div className="mt-3 inline-flex rounded-full bg-ember-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                Budget-first suggestions
              </div>
            </div>
          </article>

          {/* Kitchen life */}
          <article className="card group overflow-hidden transition hover:shadow-card-hover">
            <div className="relative h-36 overflow-hidden bg-sage-100">
              <Image
                src="/splash/feature-pantry.jpg"
                alt="Fresh ingredients"
                fill
                sizes={FEATURE_IMG_SIZES}
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-5">
              <div className={FEATURE_ICON} aria-hidden>
                📖
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-sage-900 group-hover:text-ember-700">
                Your kitchen, your story
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-sage-600">
                Browse cuisines, import cookbook photos, earn how-to badges, and
                share recipe stories with photos &amp; video. Private dietary &amp;
                allergy prefs stay yours.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* Soft CTA band */}
      <section className="border-y border-cream-300/70 bg-gradient-to-br from-cream-50 via-white to-ember-50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-bold text-sage-900 sm:text-3xl">
              Open the fridge. Forge dinner.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-sage-600 sm:text-base">
              No full grocery run required. Start with what you have — FridgeForge
              handles the rest.
            </p>
          </div>
          <SplashAuthLink
            mode="signup"
            className={`btn-primary shrink-0 px-6 py-3 ${GLOW}`}
          >
            Create your kitchen
          </SplashAuthLink>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cream-300/60 bg-cream-50/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Image
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl shadow-sm"
            />
            <div>
              <div className="font-display text-lg font-bold text-sage-900">
                FridgeForge
              </div>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.15em] text-sage-500">
                Cook what you have
              </p>
              <p className="mt-2 max-w-xs text-sm text-sage-600">
                A recipe + pantry app by Aron. Community Edition is stable and
                self-hostable.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sage-500">
                Product
              </div>
              <ul className="mt-2 space-y-1.5 text-sage-700">
                <li>
                  <a href="#features" className="hover:text-ember-700">
                    Features
                  </a>
                </li>
                <li>
                  <SplashAuthLink mode="signin" className="hover:text-ember-700">
                    Sign in
                  </SplashAuthLink>
                </li>
                <li>
                  <Link href="/howto" className="hover:text-ember-700">
                    How-to courses
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sage-500">
                Kitchen
              </div>
              <ul className="mt-2 space-y-1.5 text-sage-700">
                <li>
                  <Link href="/suggestions" className="hover:text-ember-700">
                    Cook Now
                  </Link>
                </li>
                <li>
                  <Link href="/menu" className="hover:text-ember-700">
                    Weekly menu
                  </Link>
                </li>
                <li>
                  <Link href="/struggle" className="hover:text-ember-700">
                    Struggle Mode
                  </Link>
                </li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-xs font-bold uppercase tracking-wider text-sage-500">
                Browse
              </div>
              <ul className="mt-2 space-y-1.5 text-sage-700">
                <li>
                  <Link href="/recipes" className="hover:text-ember-700">
                    Recipes
                  </Link>
                </li>
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-sage-500">
                Guests can look around without signing in.
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-cream-300/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-sage-500">
            <span>&copy; 2026 FridgeForge. All rights reserved.</span>
            <span>Warm · modern · pantry-first</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
