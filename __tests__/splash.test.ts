import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  splashAuthBody,
  validateSplashAuth,
} from "@/lib/splash-auth";

function source(rel: string): string {
  return readFileSync(resolve(__dirname, "..", rel), "utf8");
}

describe("splash auth validation", () => {
  it("requires a valid email", () => {
    expect(validateSplashAuth("signin", { email: "", password: "x" })).toMatch(/email/i);
    expect(validateSplashAuth("signin", { email: "nope", password: "x" })).toMatch(/valid email/i);
  });

  it("signin only requires a non-empty password (matches /api/auth/signin)", () => {
    expect(validateSplashAuth("signin", { email: "a@b.co", password: "" })).toMatch(/password/i);
    expect(validateSplashAuth("signin", { email: "a@b.co", password: "abc" })).toBeNull();
  });

  it("signup enforces the 6-character minimum (matches /api/auth/signup)", () => {
    expect(validateSplashAuth("signup", { email: "a@b.co", password: "12345" })).toMatch(/at least 6/);
    expect(validateSplashAuth("signup", { email: "a@b.co", password: "123456" })).toBeNull();
    expect(
      validateSplashAuth("signup", { email: "a@b.co", password: "x".repeat(201) })
    ).toMatch(/200/);
  });

  it("builds the same body /account sends", () => {
    expect(splashAuthBody("signin", { email: " a@b.co ", password: "pw", name: "Al" })).toEqual({
      email: "a@b.co",
      password: "pw",
    });
    expect(splashAuthBody("signup", { email: "a@b.co", password: "pw", name: "  " })).toEqual({
      email: "a@b.co",
      password: "pw",
    });
    expect(splashAuthBody("signup", { email: "a@b.co", password: "pw", name: " Al " })).toEqual({
      email: "a@b.co",
      password: "pw",
      name: "Al",
    });
  });
});

describe("authErrorMessage", () => {
  it("passes through server string errors", () => {
    expect(authErrorMessage("signin", 401, { error: "Invalid email or password" })).toBe(
      "Invalid email or password"
    );
    expect(authErrorMessage("signup", 409, { error: "Email already registered" })).toBe(
      "Email already registered"
    );
  });

  it("maps zod flatten payloads to one readable line", () => {
    const zod = { error: { formErrors: [], fieldErrors: { password: ["too short"] } } };
    expect(authErrorMessage("signup", 400, zod)).toMatch(/6/);
    const email = { error: { formErrors: [], fieldErrors: { email: ["Invalid email"] } } };
    expect(authErrorMessage("signin", 400, email)).toMatch(/valid email/i);
  });

  it("falls back by status", () => {
    expect(authErrorMessage("signin", 401, null)).toBe("Invalid email or password");
    expect(authErrorMessage("signin", 500, {})).toBe("Sign in failed");
    expect(authErrorMessage("signup", 500, {})).toBe("Signup failed");
  });
});

describe("splash page wiring + copy", () => {
  const splash = source("src/components/splash/Splash.tsx");
  const card = source("src/components/splash/SplashAuthCard.tsx");
  const page = source("src/app/page.tsx");

  it("decides signed-out vs home on the server via the session helper", () => {
    expect(page).not.toMatch(/^"use client"/);
    expect(page).toMatch(/getCurrentUser\(\)/);
    expect(page).toMatch(/<Splash \/>/);
  });

  it("uses the existing auth endpoints", () => {
    expect(card).toContain("/api/auth/signin");
    expect(card).toContain("/api/auth/signup");
  });

  it("drops mockup-only text and unsupported magic link", () => {
    const all = splash + card;
    expect(all).not.toMatch(/mockup|\(mock\)|no live auth|not deployed/i);
    expect(all).not.toMatch(/magic link/i);
  });

  it("keeps the public splash religion-agnostic", () => {
    const all = splash + card;
    expect(all).not.toMatch(/kosher|halal|jewish|muslim|christian|religio|shabbat|ramadan|passover/i);
  });

  it("guest browse links point at real routes", () => {
    expect(splash).toContain('href="/recipes"');
    expect(card).toContain('href="/recipes"');
  });
});
