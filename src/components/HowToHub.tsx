"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import type { HowToBadgeDTO, HowToCourseSummaryDTO } from "@/lib/howto";

type HubPayload = {
  signedIn: boolean;
  courses: HowToCourseSummaryDTO[];
  badges: (HowToBadgeDTO & { awardedAt?: string })[];
};

export function HowToHub() {
  const [data, setData] = useState<HubPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/howto");
      if (!res.ok) throw new Error("Failed to load courses");
      setData(await res.json());
      setError(null);
    } catch {
      setError("Could not load How-to courses.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded-xl border border-ember-200 bg-ember-50 px-4 py-3 text-sm text-ember-800">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="card p-6 text-sm text-sage-600">Loading courses…</div>;
  }

  return (
    <div className="space-y-6">
      {!data.signedIn && (
        <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800">
          Browse freely.{" "}
          <Link href="/account" className="font-semibold text-ember-700 underline">
            Sign in
          </Link>{" "}
          to mark lessons complete and earn badges.
        </div>
      )}

      {data.badges.length > 0 && (
        <section className="card p-5">
          <h2 className="font-display text-xl font-bold text-sage-900">
            Your badges
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.badges.map((b) => (
              <li
                key={b.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-ember-50 px-3 py-1.5 text-sm font-medium text-ember-900 ring-1 ring-ember-200"
                title={b.description ?? b.title}
              >
                <span aria-hidden>{b.emoji}</span>
                {b.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {data.courses.map((c) => {
          const pct =
            c.lessonCount === 0
              ? 0
              : Math.round((c.completedLessonCount / c.lessonCount) * 100);
          return (
            <li key={c.id}>
              <Link
                href={`/howto/${c.slug}`}
                className="card block h-full p-5 transition hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-sage-900">
                    {c.title}
                  </h2>
                  {c.badge && (
                    <span
                      className={clsx(
                        "badge shrink-0",
                        c.badgeEarned
                          ? "bg-ember-100 text-ember-800"
                          : "bg-sage-100 text-sage-600"
                      )}
                      title={c.badge.title}
                    >
                      {c.badge.emoji}{" "}
                      {c.badgeEarned ? "Earned" : "Badge"}
                    </span>
                  )}
                </div>
                {c.description && (
                  <p className="mt-2 text-sm text-sage-600">{c.description}</p>
                )}
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs font-medium text-sage-600">
                    <span>
                      {data.signedIn
                        ? `${c.completedLessonCount}/${c.lessonCount} lessons`
                        : `${c.lessonCount} lessons`}
                    </span>
                    {data.signedIn && <span>{pct}%</span>}
                  </div>
                  {data.signedIn && (
                    <div className="h-2 overflow-hidden rounded-full bg-sage-100">
                      <div
                        className="h-full rounded-full bg-sage-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {data.courses.length === 0 && (
        <div className="card p-6 text-sm text-sage-600">
          No courses yet — seed the How-to catalog to get started.
        </div>
      )}
    </div>
  );
}
