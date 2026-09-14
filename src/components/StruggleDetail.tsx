"use client";

import Link from "next/link";
import { useStruggleMode } from "./StruggleModeProvider";
import { StruggleArticleBody } from "./StruggleArticleBody";
import type { StruggleResourceDTO } from "@/lib/struggle-resources";

type Props = { resource: StruggleResourceDTO };

/** Detail article — gated by Struggle Mode (same as hub). */
export function StruggleDetail({ resource }: Props) {
  const { struggleMode, setStruggleMode } = useStruggleMode();

  if (!struggleMode) {
    return (
      <div className="card space-y-4 p-6">
        <h1 className="font-display text-2xl font-bold text-sage-900">
          {resource.title}
        </h1>
        <p className="text-sm leading-relaxed text-sage-700">
          This Struggle resource stays tucked away unless Struggle Meal mode is
          on.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setStruggleMode(true)}
        >
          Turn on Struggle Meal mode
        </button>
        <p className="text-xs text-sage-500">
          <Link href="/struggle" className="underline">
            Back to hub
          </Link>
        </p>
      </div>
    );
  }

  const sectionHref =
    resource.kind === "tip" ? "/struggle#budget-tips" : "/struggle#kids-meals";
  const sectionLabel =
    resource.kind === "tip" ? "Budget grocery tips" : "Kids eat free / reduced";

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={sectionHref}
          className="text-xs font-semibold uppercase tracking-wide text-sage-500 hover:text-ember-700"
        >
          ← {sectionLabel}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="badge bg-cream-200 text-sage-800">
            {resource.kind === "tip" ? "Budget tip" : "Kids meal"}
          </span>
          {resource.whenLabel && (
            <span className="badge bg-ember-100 text-ember-800">
              {resource.whenLabel}
            </span>
          )}
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold text-sage-900">
          {resource.title}
        </h1>
        {resource.summary && (
          <p className="mt-2 text-sm leading-relaxed text-sage-600">
            {resource.summary}
          </p>
        )}
      </div>

      <StruggleArticleBody body={resource.body} links={resource.links} />

      <p className="text-center text-xs text-sage-500">
        <Link href="/struggle" className="font-medium text-ember-700 underline">
          Struggle hub
        </Link>
      </p>
    </article>
  );
}
