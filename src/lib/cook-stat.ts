/** Scope key for RecipeCookStat tallies (household | user | guest). */
export function cookScopeKey(
  householdId: string | null,
  userId: string | null
): string {
  if (householdId) return `household:${householdId}`;
  if (userId) return `user:${userId}`;
  return "guest";
}
