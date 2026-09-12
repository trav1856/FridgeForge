import { describe, expect, it } from "vitest";
import {
  canRequestRecipe,
  countPendingIncoming,
  groupPendingByRecipe,
  recipeIsReadable,
  type IncomingRequestRow,
} from "@/lib/recipe-request";

describe("recipeIsReadable", () => {
  it("shared catalog is readable to everyone", () => {
    expect(recipeIsReadable({ householdId: null }, null)).toBe(true);
    expect(recipeIsReadable({ householdId: null }, "hh1")).toBe(true);
  });

  it("household recipes readable in-scope", () => {
    expect(
      recipeIsReadable({ householdId: "hh1", visibility: "private" }, "hh1")
    ).toBe(true);
  });

  it("public recipes readable out of scope", () => {
    expect(
      recipeIsReadable({ householdId: "hh1", visibility: "public" }, "hh2")
    ).toBe(true);
    expect(
      recipeIsReadable({ householdId: "hh1", visibility: "public" }, null)
    ).toBe(true);
  });

  it("private out-of-scope not readable", () => {
    expect(
      recipeIsReadable({ householdId: "hh1", visibility: "household" }, "hh2")
    ).toBe(false);
  });
});

describe("canRequestRecipe", () => {
  const householdRecipe = {
    id: "r1",
    householdId: "hh-owner",
    ownerUserId: "owner1",
    visibility: "public",
  };

  it("requires signed-in user", () => {
    expect(canRequestRecipe(householdRecipe, null)).toBe(false);
  });

  it("hides for shared catalog", () => {
    expect(
      canRequestRecipe(
        { id: "s", householdId: null, ownerUserId: null },
        { userId: "u1", householdId: "hh1" }
      )
    ).toBe(false);
  });

  it("hides when already in requester household", () => {
    expect(
      canRequestRecipe(householdRecipe, {
        userId: "u2",
        householdId: "hh-owner",
      })
    ).toBe(false);
  });

  it("hides for owner", () => {
    expect(
      canRequestRecipe(householdRecipe, {
        userId: "owner1",
        householdId: "hh-other",
      })
    ).toBe(false);
  });

  it("allows signed-in outsider for household recipe with owner", () => {
    expect(
      canRequestRecipe(householdRecipe, {
        userId: "u2",
        householdId: "hh-other",
      })
    ).toBe(true);
  });

  it("allows outsider with no household yet", () => {
    expect(
      canRequestRecipe(householdRecipe, {
        userId: "u2",
        householdId: null,
      })
    ).toBe(true);
  });
});

describe("countPendingIncoming", () => {
  it("counts only pending", () => {
    expect(
      countPendingIncoming([
        { status: "pending" },
        { status: "accepted" },
        { status: "pending" },
        { status: "declined" },
      ])
    ).toBe(2);
  });

  it("returns 0 for empty", () => {
    expect(countPendingIncoming([])).toBe(0);
  });
});

describe("groupPendingByRecipe", () => {
  const rows: IncomingRequestRow[] = [
    {
      id: "req-b",
      status: "pending",
      message: "pls",
      createdAt: "2026-01-02T00:00:00.000Z",
      recipe: { id: "roast", title: "Yankee Pot Roast" },
      fromUser: { id: "u2", email: "b@ex.com", name: "Bob" },
    },
    {
      id: "req-a",
      status: "pending",
      message: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      recipe: { id: "roast", title: "Yankee Pot Roast" },
      fromUser: { id: "u1", email: "a@ex.com", name: "Ann" },
    },
    {
      id: "req-c",
      status: "accepted",
      message: null,
      createdAt: "2026-01-03T00:00:00.000Z",
      recipe: { id: "roast", title: "Yankee Pot Roast" },
      fromUser: { id: "u3", email: "c@ex.com", name: "Cara" },
    },
    {
      id: "req-d",
      status: "pending",
      message: "hi",
      createdAt: "2026-01-04T00:00:00.000Z",
      recipe: { id: "pie", title: "Apple Pie" },
      fromUser: { id: "u4", email: "d@ex.com", name: null },
    },
  ];

  it("groups pending by recipe and sorts by title", () => {
    const groups = groupPendingByRecipe(rows);
    expect(groups.map((g) => g.recipeId)).toEqual(["pie", "roast"]);
    expect(groups[0].requests).toHaveLength(1);
    expect(groups[1].requests.map((r) => r.id)).toEqual(["req-a", "req-b"]);
  });

  it("omits resolved-only recipes", () => {
    const groups = groupPendingByRecipe([
      {
        id: "x",
        status: "declined",
        message: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        recipe: { id: "gone", title: "Gone" },
        fromUser: { id: "u", email: "u@ex.com", name: null },
      },
    ]);
    expect(groups).toEqual([]);
  });
});
