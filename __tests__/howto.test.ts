import { describe, expect, it } from "vitest";
import {
  isCourseComplete,
  shouldAwardCourseBadge,
} from "@/lib/howto";

describe("isCourseComplete", () => {
  it("requires every lesson id", () => {
    expect(isCourseComplete(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(isCourseComplete(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
  });

  it("returns false for empty courses", () => {
    expect(isCourseComplete([], [])).toBe(false);
    expect(isCourseComplete([], ["x"])).toBe(false);
  });

  it("accepts a Set of completed ids", () => {
    expect(isCourseComplete(["a", "b"], new Set(["b", "a"]))).toBe(true);
  });
});

describe("shouldAwardCourseBadge", () => {
  const lessons = ["l1", "l2", "l3"];

  it("awards when the last incomplete lesson is completed", () => {
    expect(
      shouldAwardCourseBadge({
        lessonIds: lessons,
        completedLessonIdsBefore: ["l1", "l2"],
        newlyCompletedLessonId: "l3",
        badgeId: "badge-1",
        alreadyHasBadge: false,
      })
    ).toBe(true);
  });

  it("does not award mid-course", () => {
    expect(
      shouldAwardCourseBadge({
        lessonIds: lessons,
        completedLessonIdsBefore: ["l1"],
        newlyCompletedLessonId: "l2",
        badgeId: "badge-1",
        alreadyHasBadge: false,
      })
    ).toBe(false);
  });

  it("does not award without a badge configured", () => {
    expect(
      shouldAwardCourseBadge({
        lessonIds: lessons,
        completedLessonIdsBefore: ["l1", "l2"],
        newlyCompletedLessonId: "l3",
        badgeId: null,
        alreadyHasBadge: false,
      })
    ).toBe(false);
  });

  it("does not award if the user already has the badge", () => {
    expect(
      shouldAwardCourseBadge({
        lessonIds: lessons,
        completedLessonIdsBefore: ["l1", "l2"],
        newlyCompletedLessonId: "l3",
        badgeId: "badge-1",
        alreadyHasBadge: true,
      })
    ).toBe(false);
  });

  it("is idempotent when re-completing an already-done lesson on a finished course", () => {
    expect(
      shouldAwardCourseBadge({
        lessonIds: lessons,
        completedLessonIdsBefore: ["l1", "l2", "l3"],
        newlyCompletedLessonId: "l3",
        badgeId: "badge-1",
        alreadyHasBadge: false,
      })
    ).toBe(true);
  });

  it("does not award when re-completing mid-course", () => {
    expect(
      shouldAwardCourseBadge({
        lessonIds: lessons,
        completedLessonIdsBefore: ["l1", "l2"],
        newlyCompletedLessonId: "l1",
        badgeId: "badge-1",
        alreadyHasBadge: false,
      })
    ).toBe(false);
  });
});
