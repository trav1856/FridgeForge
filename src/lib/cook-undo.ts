/** 24 hours in milliseconds. */
export const COOK_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export type CookUndoSessionLike = {
  id: string;
  createdAt: Date;
  undoneAt: Date | null;
  active?: boolean;
};

/** True when a cook session can still be undone via “I’m making something different”. */
export function isUndoWithin24hEligible(
  session: Pick<CookUndoSessionLike, "createdAt" | "undoneAt">,
  now: Date = new Date()
): boolean {
  if (session.undoneAt != null) return false;
  const age = now.getTime() - session.createdAt.getTime();
  return age >= 0 && age <= COOK_UNDO_WINDOW_MS;
}

/**
 * Latest session eligible for 24h pantry restore undo, or null.
 * Prefers most recent by createdAt among not-yet-undone cooks in the window.
 */
export function pickUndoWithin24h(
  sessions: CookUndoSessionLike[],
  now: Date = new Date()
): { sessionId: string; cookedAt: string } | null {
  const eligible = sessions
    .filter((s) => isUndoWithin24hEligible(s, now))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const top = eligible[0];
  if (!top) return null;
  return {
    sessionId: top.id,
    cookedAt: top.createdAt.toISOString(),
  };
}
