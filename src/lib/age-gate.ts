/** Minimum-age gate (pure). The date of birth is checked, never stored. */

/** Floor is 13; FF_MIN_AGE may raise it (e.g. for a stricter jurisdiction), never lower it. */
export function minAge(env: string | undefined = process.env.FF_MIN_AGE): number {
  const n = Number.parseInt(env ?? "", 10);
  return Number.isFinite(n) && n > 13 ? Math.min(n, 21) : 13;
}

/** Parse YYYY-MM-DD strictly (real calendar date). */
export function parseBirthDate(raw: unknown): { y: number; m: number; d: number } | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1]!, mo = +m[2]!, d = +m[3]!;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/** Whole years between birth date and `today` (UTC calendar). */
export function ageOn(birth: { y: number; m: number; d: number }, today: Date): number {
  const ty = today.getUTCFullYear(), tm = today.getUTCMonth() + 1, td = today.getUTCDate();
  let age = ty - birth.y;
  if (tm < birth.m || (tm === birth.m && td < birth.d)) age--;
  return age;
}

export type AgeCheck =
  | { ok: true }
  | { ok: false; code: "INVALID_BIRTH_DATE" | "UNDER_MIN_AGE"; error: string };

export function checkMinAge(raw: unknown, today = new Date(), min = minAge()): AgeCheck {
  const b = parseBirthDate(raw);
  if (!b) return { ok: false, code: "INVALID_BIRTH_DATE", error: "Enter your date of birth." };
  const age = ageOn(b, today);
  if (age > 120 || age < 0) return { ok: false, code: "INVALID_BIRTH_DATE", error: "Enter your date of birth." };
  if (age < min) {
    return {
      ok: false,
      code: "UNDER_MIN_AGE",
      error: `Sorry, you need to be ${min} or older to use a FridgeForge account.`,
    };
  }
  return { ok: true };
}

/** Cookie set after an under-age attempt so the form can't simply be retried with a new date. */
export const AGE_BLOCK_COOKIE = "ff_age_block";
export const AGE_BLOCK_SECONDS = 24 * 60 * 60;
