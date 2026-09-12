"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import type { HowToCourseDetailDTO } from "@/lib/howto";

export function HowToCourseView({ courseSlug }: { courseSlug: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [course, setCourse] = useState<HowToCourseDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/howto/${encodeURIComponent(courseSlug)}`);
      if (res.status === 404) {
        setMissing(true);
        return;
      }
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setSignedIn(Boolean(data.signedIn));
      setCourse(data.course);
      setError(null);
    } catch {
      setError("Could not load this course.");
    }
  }, [courseSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (missing) {
    return (
      <div className="card p-6 text-sm text-sage-600">
        Course not found.{" "}
        <Link href="/howto" className="font-semibold text-ember-700 underline">
          Back to How-to
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-ember-200 bg-ember-50 px-4 py-3 text-sm text-ember-800">
        {error}
      </div>
    );
  }

  if (!course) {
    return <div className="card p-6 text-sm text-sage-600">Loading course…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/howto"
          className="text-xs font-semibold uppercase tracking-wide text-sage-500 hover:text-ember-700"
        >
          ← How-to
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-sage-900">
          {course.title}
        </h1>
        {course.description && (
          <p className="mt-1 text-sm text-sage-600">{course.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sage-700">
          {signedIn ? (
            <span>
              {course.completedLessonCount}/{course.lessonCount} lessons complete
              {course.complete ? " · Course finished" : ""}
            </span>
          ) : (
            <span>{course.lessonCount} lessons · Sign in to track progress</span>
          )}
          {course.badge && (
            <span
              className={clsx(
                "badge",
                course.badgeEarned
                  ? "bg-ember-100 text-ember-800"
                  : "bg-sage-100 text-sage-700"
              )}
            >
              {course.badge.emoji} {course.badge.title}
              {course.badgeEarned ? " — earned" : ""}
            </span>
          )}
        </div>
      </div>

      {!signedIn && (
        <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800">
          Guests can read every lesson.{" "}
          <Link href="/account" className="font-semibold text-ember-700 underline">
            Sign in
          </Link>{" "}
          to mark complete and earn the course badge.
        </div>
      )}

      <ol className="space-y-3">
        {course.lessons.map((l, idx) => (
          <li key={l.id}>
            <Link
              href={`/howto/${course.slug}/${l.slug}`}
              className="card flex items-start gap-3 p-4 transition hover:shadow-card-hover"
            >
              <span
                className={clsx(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  l.completed
                    ? "bg-sage-800 text-cream-50"
                    : "bg-sage-100 text-sage-700"
                )}
              >
                {l.completed ? "✓" : idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sage-900">{l.title}</div>
                {l.summary && (
                  <p className="mt-0.5 text-sm text-sage-600">{l.summary}</p>
                )}
                {l.estimatedMinutes != null && (
                  <p className="mt-1 text-xs text-sage-500">
                    ~{l.estimatedMinutes} min
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
