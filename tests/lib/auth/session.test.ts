import { beforeEach, describe, expect, it, vi } from "vitest";

const cookie_store = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookie_store),
}));

vi.mock("@/lib/auth/jwt", async (import_original) => ({
  ...(await import_original<typeof import("@/lib/auth/jwt")>()),
  sign_session_token: vi.fn(),
  verify_session_token: vi.fn(),
}));

import { sign_session_token, verify_session_token } from "@/lib/auth/jwt";
import { end_session, get_session, require_session, start_session } from "@/lib/auth/session";

const session = { user_id: "user_1", email: "maria@example.com" };

describe("session", () => {
  beforeEach(() => {
    cookie_store.get.mockReturnValue(undefined);
  });

  describe("get_session", () => {
    it("returns null when there is no session cookie", async () => {
      await expect(get_session()).resolves.toBeNull();
      expect(cookie_store.get).toHaveBeenCalledWith("session");
      expect(verify_session_token).not.toHaveBeenCalled();
    });

    it("verifies the cookie token", async () => {
      cookie_store.get.mockReturnValue({ value: "token" });
      vi.mocked(verify_session_token).mockResolvedValue(session);

      await expect(get_session()).resolves.toEqual(session);
      expect(verify_session_token).toHaveBeenCalledWith("token");
    });
  });

  describe("require_session", () => {
    it("returns the session when authenticated", async () => {
      cookie_store.get.mockReturnValue({ value: "token" });
      vi.mocked(verify_session_token).mockResolvedValue(session);
      await expect(require_session()).resolves.toEqual(session);
    });

    it("throws UNAUTHORIZED when not authenticated", async () => {
      await expect(require_session()).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    });
  });

  describe("start_session", () => {
    it("stores a signed httpOnly cookie", async () => {
      vi.mocked(sign_session_token).mockResolvedValue("signed_token");
      vi.stubEnv("NODE_ENV", "development");

      await start_session(session);

      expect(sign_session_token).toHaveBeenCalledWith(session);
      expect(cookie_store.set).toHaveBeenCalledWith("session", "signed_token", {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 604800,
      });
    });

    it("marks the cookie as secure in production", async () => {
      vi.mocked(sign_session_token).mockResolvedValue("signed_token");
      vi.stubEnv("NODE_ENV", "production");

      await start_session(session);

      expect(cookie_store.set).toHaveBeenCalledWith(
        "session",
        "signed_token",
        expect.objectContaining({ secure: true }),
      );
    });
  });

  it("end_session deletes the cookie", async () => {
    await end_session();
    expect(cookie_store.delete).toHaveBeenCalledWith("session");
  });
});
