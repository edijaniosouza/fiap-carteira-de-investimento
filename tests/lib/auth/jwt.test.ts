import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sign_session_token,
  verify_session_token,
} from "@/lib/auth/jwt";

const SECRET = "a".repeat(32);

function sign_custom(claims: Record<string, unknown>, subject?: string, secret = SECRET) {
  const jwt = new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h");
  if (subject) {
    jwt.setSubject(subject);
  }
  return jwt.sign(new TextEncoder().encode(secret));
}

describe("jwt", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", SECRET);
  });

  it("exposes the session cookie settings", () => {
    expect(SESSION_COOKIE_NAME).toBe("session");
    expect(SESSION_MAX_AGE_SECONDS).toBe(604800);
  });

  it("signs a token that verifies back to the same payload", async () => {
    const token = await sign_session_token({ user_id: "user_1", email: "maria@example.com" });
    expect(token.split(".")).toHaveLength(3);
    await expect(verify_session_token(token)).resolves.toEqual({
      user_id: "user_1",
      email: "maria@example.com",
    });
  });

  it("throws when JWT_SECRET is missing or too short", async () => {
    vi.stubEnv("JWT_SECRET", "short");
    await expect(sign_session_token({ user_id: "u", email: "e" })).rejects.toThrow(
      "JWT_SECRET must be defined with at least 32 characters",
    );
    vi.stubEnv("JWT_SECRET", "");
    await expect(sign_session_token({ user_id: "u", email: "e" })).rejects.toThrow();
  });

  it("returns null for malformed tokens", async () => {
    await expect(verify_session_token("not-a-jwt")).resolves.toBeNull();
  });

  it("returns null for tokens signed with another secret", async () => {
    const token = await sign_custom({ email: "x@example.com" }, "user_1", "b".repeat(32));
    await expect(verify_session_token(token)).resolves.toBeNull();
  });

  it("returns null when the subject is missing", async () => {
    const token = await sign_custom({ email: "x@example.com" });
    await expect(verify_session_token(token)).resolves.toBeNull();
  });

  it("returns null when the email claim is not a string", async () => {
    const token = await sign_custom({ email: 42 }, "user_1");
    await expect(verify_session_token(token)).resolves.toBeNull();
  });

  it("returns null for expired tokens", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const token = await sign_session_token({ user_id: "user_1", email: "maria@example.com" });
      vi.setSystemTime(new Date("2026-01-09T00:00:00.000Z"));
      await expect(verify_session_token(token)).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns null when the secret is not configured at verification time", async () => {
    const token = await sign_session_token({ user_id: "user_1", email: "maria@example.com" });
    vi.stubEnv("JWT_SECRET", "");
    await expect(verify_session_token(token)).resolves.toBeNull();
  });
});
