import { describe, expect, it } from "vitest";
import {
  COOK_UNDO_WINDOW_MS,
  isUndoWithin24hEligible,
  pickUndoWithin24h,
} from "@/lib/cook-undo";
import { planPantryRestore } from "@/lib/pantry-deduct";

describe("isUndoWithin24hEligible", () => {
  const now = new Date("2026-09-09T12:00:00.000Z");

  it("allows a cook within 24h that was not undone", () => {
    expect(
      isUndoWithin24hEligible(
        {
          createdAt: new Date("2026-09-09T01:00:00.000Z"),
          undoneAt: null,
        },
        now
      )
    ).toBe(true);
  });

  it("rejects after the 24h window", () => {
    expect(
      isUndoWithin24hEligible(
        {
          createdAt: new Date(now.getTime() - COOK_UNDO_WINDOW_MS - 1),
          undoneAt: null,
        },
        now
      )
    ).toBe(false);
  });

  it("allows exactly at the 24h boundary", () => {
    expect(
      isUndoWithin24hEligible(
        {
          createdAt: new Date(now.getTime() - COOK_UNDO_WINDOW_MS),
          undoneAt: null,
        },
        now
      )
    ).toBe(true);
  });

  it("rejects when already undone", () => {
    expect(
      isUndoWithin24hEligible(
        {
          createdAt: new Date("2026-09-09T11:00:00.000Z"),
          undoneAt: new Date("2026-09-09T11:30:00.000Z"),
        },
        now
      )
    ).toBe(false);
  });
});

describe("pickUndoWithin24h", () => {
  const now = new Date("2026-09-09T12:00:00.000Z");

  it("picks the most recent eligible session", () => {
    const picked = pickUndoWithin24h(
      [
        {
          id: "old",
          createdAt: new Date("2026-09-09T02:00:00.000Z"),
          undoneAt: null,
          active: false,
        },
        {
          id: "new",
          createdAt: new Date("2026-09-09T10:00:00.000Z"),
          undoneAt: null,
          active: false,
        },
        {
          id: "undone",
          createdAt: new Date("2026-09-09T11:00:00.000Z"),
          undoneAt: new Date("2026-09-09T11:05:00.000Z"),
          active: false,
        },
        {
          id: "stale",
          createdAt: new Date("2026-09-07T12:00:00.000Z"),
          undoneAt: null,
          active: false,
        },
      ],
      now
    );
    expect(picked).toEqual({
      sessionId: "new",
      cookedAt: "2026-09-09T10:00:00.000Z",
    });
  });

  it("returns null when nothing is eligible", () => {
    expect(
      pickUndoWithin24h(
        [
          {
            id: "undone",
            createdAt: new Date("2026-09-09T11:00:00.000Z"),
            undoneAt: new Date("2026-09-09T11:05:00.000Z"),
          },
        ],
        now
      )
    ).toBeNull();
  });
});

describe("undo restore from deductionsJson", () => {
  it("restores quantityBefore amounts (idempotent absolute set)", () => {
    const restores = planPantryRestore([
      { pantryItemId: "p1", quantityBefore: 1 },
      { pantryItemId: "p2", quantityBefore: 4 },
    ]);
    expect(restores).toEqual([
      { pantryItemId: "p1", quantity: 1 },
      { pantryItemId: "p2", quantity: 4 },
    ]);
    // Second pass yields the same absolute targets (idempotent restore).
    expect(planPantryRestore([
      { pantryItemId: "p1", quantityBefore: 1 },
      { pantryItemId: "p2", quantityBefore: 4 },
    ])).toEqual(restores);
  });
});
