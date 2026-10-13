import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/jwt", async (import_original) => ({
  ...(await import_original<typeof import("@/lib/auth/jwt")>()),
  verify_session_token: vi.fn(),
}));

import { verify_session_token } from "@/lib/auth/jwt";
import { config, proxy } from "@/proxy";

function request(path: string, token?: string): NextRequest {
  const next_request = new NextRequest(`http://localhost:3000${path}`);
  if (token) {
    next_request.cookies.set("session", token);
  }
  return next_request;
}

function authenticate() {
  vi.mocked(verify_session_token).mockResolvedValue({ user_id: "user_1", email: "maria@example.com" });
}

function is_next(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

describe("proxy", () => {
  beforeEach(() => {
    vi.mocked(verify_session_token).mockResolvedValue(null);
  });

  describe("API routes", () => {
    it("lets public auth endpoints through without session", async () => {
      for (const path of [
        "/api/auth/sign_up",
        "/api/auth/sign_in",
        "/api/auth/forgot_password",
        "/api/auth/reset_password",
      ]) {
        expect(is_next(await proxy(request(path)))).toBe(true);
      }
      expect(verify_session_token).not.toHaveBeenCalled();
    });

    it("answers 401 JSON for protected endpoints without session", async () => {
      const response = await proxy(request("/api/portfolios"));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "Não autenticado" } });
    });

    it("answers 401 when the token is invalid", async () => {
      const response = await proxy(request("/api/portfolios", "bad_token"));
      expect(verify_session_token).toHaveBeenCalledWith("bad_token");
      expect(response.status).toBe(401);
    });

    it("lets authenticated requests through", async () => {
      authenticate();
      expect(is_next(await proxy(request("/api/portfolios", "token")))).toBe(true);
    });
  });

  describe("auth pages", () => {
    it("shows auth pages to anonymous users", async () => {
      expect(is_next(await proxy(request("/sign_in")))).toBe(true);
      expect(is_next(await proxy(request("/reset_password")))).toBe(true);
    });

    it("redirects authenticated users to the dashboard", async () => {
      authenticate();
      const response = await proxy(request("/sign_up", "token"));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });
  });

  describe("app pages", () => {
    it("redirects anonymous users to sign in keeping the target path", async () => {
      const response = await proxy(request("/portfolios/p1/transactions?tab=all"));
      const location = new URL(response.headers.get("location") as string);
      expect(location.pathname).toBe("/sign_in");
      expect(location.searchParams.get("next")).toBe("/portfolios/p1/transactions?tab=all");
    });

    it("redirects anonymous users from the root without next param", async () => {
      const response = await proxy(request("/"));
      expect(response.headers.get("location")).toBe("http://localhost:3000/sign_in");
    });

    it("redirects authenticated users from the root to the dashboard", async () => {
      authenticate();
      const response = await proxy(request("/", "token"));
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("lets authenticated users access app pages", async () => {
      authenticate();
      expect(is_next(await proxy(request("/catalog", "token")))).toBe(true);
    });
  });

  it("matches everything except static assets", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/dashboard")).toBe(true);
    expect(matcher.test("/api/portfolios")).toBe(true);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    expect(matcher.test("/favicon.ico")).toBe(false);
    expect(matcher.test("/logo.svg")).toBe(false);
  });
});
