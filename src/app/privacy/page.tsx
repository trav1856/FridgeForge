import type { Metadata } from "next";
import { CONSENT_TEXT, K_ANON, RESEARCH_MIN_AGE } from "@/lib/demographics/options";

export const metadata: Metadata = { title: "Privacy · FridgeForge" };

export default function PrivacyPage() {
  return (
    <article className="prose-sm mx-auto max-w-2xl space-y-5 text-sage-800" data-testid="privacy-page">
      <h1 className="font-display text-3xl font-semibold text-sage-900">Privacy</h1>
      <p className="text-sm text-sage-600">Last updated October 14, 2026</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-sage-900">What we keep</h2>
        <p>Your account (email, a hashed password), your household, pantry, recipes, shopping lists, favorites and any profile you choose to make public. We check your date of birth at sign-up to confirm you meet the minimum age, but we don&apos;t store it.</p>
        <p>When you&apos;re signed in we also keep a simple history of which recipes you open (and their cuisine) so we can show you a private &ldquo;My taste&rdquo; summary. You can clear it any time on your profile page.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-sage-900">Optional private details</h2>
        <p>On your profile page you can add sex, ethnicity / heritage and family-origin countries. All of these are optional. They are never shown on your public profile or anywhere else on the site. You can change or remove them whenever you like.</p>
      </section>

      <section className="space-y-2" data-testid="privacy-research">
        <h2 className="text-lg font-semibold text-sage-900">Research sharing (opt-in)</h2>
        <p>If you tick the box on your profile page, you agree to the following:</p>
        <blockquote className="border-l-4 border-ember-300 pl-3 italic">{CONSENT_TEXT}</blockquote>
        <ul className="list-disc space-y-1 pl-5">
          <li>It is off unless you turn it on, and it is only available if you confirm you are {RESEARCH_MIN_AGE} or older.</li>
          <li>Only people who opted in are counted. Reports contain totals only, such as how often a cuisine is viewed or favorited by a broad group.</li>
          <li>Any number or group that would cover fewer than {K_ANON} people is left out, so a report can&apos;t single anyone out.</li>
          <li>Reports never include your name, email, account id, profile, or anything else that identifies you.</li>
        </ul>
      </section>

      <section className="space-y-2" data-testid="privacy-optout">
        <h2 className="text-lg font-semibold text-sage-900">How to opt out</h2>
        <p>Go to <a href="/account/profile" className="underline">your profile page</a>, uncheck the research-sharing box and save. From then on you are left out of every new report. Reports already shared before you opted out contained only anonymous totals and can&apos;t be recalled. Deleting your account also removes your private details and view history.</p>
      </section>
    </article>
  );
}
