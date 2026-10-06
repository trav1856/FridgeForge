import { z } from "zod";

/** Shared password rules (sign-up and admin-issued reset links). */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 200;

export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
