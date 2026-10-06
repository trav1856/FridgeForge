/**
 * Shared helpers for the signed-out splash auth card.
 * Rules mirror /api/auth/signin + /api/auth/signup (zod schemas there).
 */

export type SplashAuthMode = "signin" | "signup";

/** Window event used by splash CTAs to open/focus the auth card. */
export const SPLASH_AUTH_EVENT = "ff:splash-auth";

export type SplashAuthEventDetail = { mode?: SplashAuthMode };

export const PASSWORD_MIN = 6; // signup schema: z.string().min(6)
export const PASSWORD_MAX = 200;
export const EMAIL_MAX = 200;
export const NAME_MAX = 120;

export type SplashAuthInput = {
  email: string;
  password: string;
  name?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side check before hitting the API. Returns an inline error or null. */
export function validateSplashAuth(
  mode: SplashAuthMode,
  input: SplashAuthInput
): string | null {
  const email = input.email.trim();
  if (!email) return "Enter your email.";
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    return "Enter a valid email address.";
  }
  if (!input.password) return "Enter your password.";
  if (input.password.length > PASSWORD_MAX) {
    return `Password must be ${PASSWORD_MAX} characters or fewer.`;
  }
  if (mode === "signup") {
    if (input.password.length < PASSWORD_MIN) {
      return `Password must be at least ${PASSWORD_MIN} characters.`;
    }
    if ((input.name ?? "").trim().length > NAME_MAX) {
      return `Name must be ${NAME_MAX} characters or fewer.`;
    }
  }
  return null;
}

/** Request body for the existing auth endpoints (same shape /account sends). */
export function splashAuthBody(
  mode: SplashAuthMode,
  input: SplashAuthInput
): Record<string, string> {
  const name = (input.name ?? "").trim();
  return {
    email: input.email.trim(),
    password: input.password,
    ...(mode === "signup" && name ? { name } : {}),
  };
}

/** Turn an auth API error payload into one readable inline message. */
export function authErrorMessage(
  mode: SplashAuthMode,
  status: number,
  data: unknown
): string {
  const err = (data as { error?: unknown } | null)?.error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const fields = (err as { fieldErrors?: Record<string, unknown> }).fieldErrors;
    if (fields && typeof fields === "object") {
      if (Array.isArray(fields.email) && fields.email.length) {
        return "Enter a valid email address.";
      }
      if (Array.isArray(fields.password) && fields.password.length) {
        return mode === "signup"
          ? `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`
          : "Enter your password.";
      }
      if (Array.isArray(fields.name) && fields.name.length) {
        return `Name must be ${NAME_MAX} characters or fewer.`;
      }
    }
  }
  if (status === 401) return "Invalid email or password";
  return mode === "signup" ? "Signup failed" : "Sign in failed";
}
