"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { HowToCourseDetailDTO, HowToLessonDTO } from "@/lib/howto";

export function HowToLessonView({
  courseSlug,
  lessonSlug,
}: {
  courseSlug: string;
  lessonSlug: string;
}) {
  const [signedIn, setSignedIn] = useState(false);
  const [course, setCourse] = useState<HowToCourseDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

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
      setError("Could not load this lesson.");
    }
  }, [courseSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const lesson: HowToLessonDTO | null = useMemo(() => {
    if (!course) return null;
    return course.lessons.find((l) => l.slug === lessonSlug) ?? null;
  }, [course, lessonSlug]);

  const neighbors = useMemo(() => {
    if (!course || !lesson) return { prev: null, next: null };
    const idx = course.lessons.findIndex((l) => l.id === lesson.id);
    return {
      prev: idx > 0 ? course.lessons[idx - 1]! : null,
      next:
        idx >= 0 && idx < course.lessons.length - 1
          ? course.lessons[idx + 1]!
          : null,
    };
  }, [course, lesson]);

  async function onComplete() {
    if (!lesson) return;
    setBusy(true);
    setFlash(null);
    setError(null);
    try {
      const res = await fetch(`/api/howto/lessons/${lesson.id}/complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.status === 401) {
        setFlash(
          typeof data.error === "string"
            ? data.error
            : "Sign in to track progress and earn badges."
        );
        return;
      }
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Could not save progress"
        );
        return;
      }
      if (data.badgeAwarded) {
        setFlash(
          `Course complete! Badge earned: ${data.badgeAwarded.emoji} ${data.badgeAwarded.title}`
        );
      } else if (data.alreadyComplete) {
        setFlash("Already marked complete.");
      } else if (data.courseComplete) {
        setFlash("Lesson complete — you finished the course!");
      } else {
        setFlash("Lesson marked complete.");
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (missing || (course && !lesson)) {
    return (
      <div className="card p-6 text-sm text-sage-600">
        Lesson not found.{" "}
        <Link
          href={`/howto/${courseSlug}`}
          className="font-semibold text-ember-700 underline"
        >
          Back to course
        </Link>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="rounded-xl border border-ember-200 bg-ember-50 px-4 py-3 text-sm text-ember-800">
        {error}
      </div>
    );
  }

  if (!course || !lesson) {
    return <div className="card p-6 text-sm text-sage-600">Loading lesson…</div>;
  }

  const paragraphs = lesson.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/howto/${course.slug}`}
          className="text-xs font-semibold uppercase tracking-wide text-sage-500 hover:text-ember-700"
        >
          ← {course.title}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-sage-900">
          {lesson.title}
        </h1>
        {lesson.summary && (
          <p className="mt-1 text-sm text-sage-600">{lesson.summary}</p>
        )}
      </div>

      {flash && (
        <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800">
          {flash}{" "}
          {!signedIn && (
            <Link href="/account" className="font-semibold text-ember-700 underline">
              Sign in
            </Link>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-ember-200 bg-ember-50 px-4 py-3 text-sm text-ember-800">
          {error}
        </div>
      )}

      <article className="card space-y-4 p-5 sm:p-6">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-base leading-relaxed text-sage-800 whitespace-pre-line">
            {p}
          </p>
        ))}
      </article>

      <div className="flex flex-wrap items-center gap-3">
        {lesson.completed ? (
          <span className="badge bg-sage-800 text-cream-50">Completed</span>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void onComplete()}
          >
            {busy ? "Saving…" : "Mark complete"}
          </button>
        )}
        {!signedIn && !lesson.completed && (
          <span className="text-xs text-sage-600">
            Requires sign-in to save progress & badges
          </span>
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t border-cream-300 pt-4">
        {neighbors.prev ? (
          <Link
            href={`/howto/${course.slug}/${neighbors.prev.slug}`}
            className="btn-secondary text-sm"
          >
            ← {neighbors.prev.title}
          </Link>
        ) : (
          <span />
        )}
        {neighbors.next ? (
          <Link
            href={`/howto/${course.slug}/${neighbors.next.slug}`}
            className="btn-secondary text-sm"
          >
            {neighbors.next.title} →
          </Link>
        ) : (
          <Link href={`/howto/${course.slug}`} className="btn-secondary text-sm">
            Back to course
          </Link>
        )}
      </div>
    </div>
  );
}
