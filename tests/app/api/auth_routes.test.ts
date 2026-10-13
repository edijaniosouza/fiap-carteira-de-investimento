import { beforeEach, describe, expect, it, vi } from "vitest";
import { build_user_dto } from "../../support/factories";
import { get_request, json_request, route_context, SESSION } from "../../support/route_helpers";

vi.mock("@/lib/auth/session", () => ({
  require_session: vi.fn(),
  start_session: vi.fn(),
  end_session: vi.fn(),
}));
vi.mock("@/services/auth_service", () => ({
  sign_up: vi.fn(),
  sign_in: vi.fn(),
  request_password_reset: vi.fn(),
  reset_password: vi.fn(),
  get_user: vi.fn(),
  update_profile: vi.fn(),
}));

import { POST as forgot_password_post } from "@/app/api/auth/forgot_password/route";
import { GET as profile_get, PATCH as profile_patch } from "@/app/api/auth/profile/route";
import { POST as reset_password_post } from "@/app/api/auth/reset_password/route";
import { POST as sign_in_post } from "@/app/api/auth/sign_in/route";
import { POST as sign_out_post } from "@/app/api/auth/sign_out/route";
import { POST as sign_up_post } from "@/app/api/auth/sign_up/route";
import { end_session, require_session, start_session } from "@/lib/auth/session";
import { unauthorized_error } from "@/lib/errors";
import {
  get_user,
  request_password_reset,
  reset_password,
  sign_in,
  sign_up,
  update_profile,
} from "@/services/auth_service";

const user = build_user_dto();
const no_context = route_context({});

describe("auth routes", () => {
  beforeEach(() => {
    vi.mocked(require_session).mockResolvedValue(SESSION);
  });

  describe("POST /api/auth/sign_up", () => {
    it("creates the account, starts the session and answers 201", async () => {
      vi.mocked(sign_up).mockResolvedValue(user);

      const response = await sign_up_post(
        json_request("/api/auth/sign_up", "POST", { name: "Maria", email: "MARIA@example.com", password: "12345678" }),
        no_context,
      );

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(user);
      expect(sign_up).toHaveBeenCalledWith({ name: "Maria", email: "maria@example.com", password: "12345678" });
      expect(start_session).toHaveBeenCalledWith({ user_id: "user_1", email: "maria@example.com" });
    });

    it("answers 400 with field errors for invalid payloads", async () => {
      const response = await sign_up_post(
        json_request("/api/auth/sign_up", "POST", { name: "", email: "x", password: "1" }),
        no_context,
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(Object.keys(body.error.details)).toEqual(["name", "email", "password"]);
      expect(sign_up).not.toHaveBeenCalled();
    });

    it("answers 400 INVALID_JSON for malformed bodies", async () => {
      const response = await sign_up_post(json_request("/api/auth/sign_up", "POST", "{oops"), no_context);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_JSON");
    });
  });

  describe("POST /api/auth/sign_in", () => {
    it("signs in and starts the session", async () => {
      vi.mocked(sign_in).mockResolvedValue(user);

      const response = await sign_in_post(
        json_request("/api/auth/sign_in", "POST", { email: "maria@example.com", password: "x" }),
        no_context,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(user);
      expect(start_session).toHaveBeenCalledWith({ user_id: "user_1", email: "maria@example.com" });
    });

    it("forwards service errors", async () => {
      const { AppError } = await import("@/lib/errors");
      vi.mocked(sign_in).mockRejectedValue(new AppError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos"));

      const response = await sign_in_post(
        json_request("/api/auth/sign_in", "POST", { email: "maria@example.com", password: "x" }),
        no_context,
      );

      expect(response.status).toBe(401);
      expect(start_session).not.toHaveBeenCalled();
    });
  });

  it("POST /api/auth/sign_out ends the session with 204", async () => {
    const response = await sign_out_post(json_request("/api/auth/sign_out", "POST"), no_context);
    expect(response.status).toBe(204);
    expect(end_session).toHaveBeenCalled();
  });

  it("POST /api/auth/forgot_password always answers with a neutral message", async () => {
    const response = await forgot_password_post(
      json_request("/api/auth/forgot_password", "POST", { email: "maria@example.com" }),
      no_context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
    });
    expect(request_password_reset).toHaveBeenCalledWith("maria@example.com");
  });

  it("POST /api/auth/reset_password resets the password", async () => {
    const response = await reset_password_post(
      json_request("/api/auth/reset_password", "POST", { token: "abc", password: "12345678" }),
      no_context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Senha redefinida com sucesso." });
    expect(reset_password).toHaveBeenCalledWith({ token: "abc", password: "12345678" });
  });

  describe("/api/auth/profile", () => {
    it("GET returns the current user", async () => {
      vi.mocked(get_user).mockResolvedValue(user);

      const response = await profile_get(get_request("/api/auth/profile"), no_context);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(user);
      expect(get_user).toHaveBeenCalledWith("user_1");
    });

    it("GET answers 401 without session", async () => {
      vi.mocked(require_session).mockRejectedValue(unauthorized_error());
      const response = await profile_get(get_request("/api/auth/profile"), no_context);
      expect(response.status).toBe(401);
    });

    it("PATCH updates the profile keeping the session when the e-mail is unchanged", async () => {
      vi.mocked(update_profile).mockResolvedValue({ ...user, name: "Maria Souza" });

      const response = await profile_patch(
        json_request("/api/auth/profile", "PATCH", { name: "Maria Souza" }),
        no_context,
      );

      expect(response.status).toBe(200);
      expect(update_profile).toHaveBeenCalledWith("user_1", { name: "Maria Souza" });
      expect(start_session).not.toHaveBeenCalled();
    });

    it("PATCH re-issues the session when the e-mail changes", async () => {
      vi.mocked(update_profile).mockResolvedValue({ ...user, email: "new@example.com" });

      await profile_patch(
        json_request("/api/auth/profile", "PATCH", { email: "new@example.com", current_password: "x" }),
        no_context,
      );

      expect(start_session).toHaveBeenCalledWith({ user_id: "user_1", email: "new@example.com" });
    });

    it("PATCH validates that sensitive changes include the current password", async () => {
      const response = await profile_patch(
        json_request("/api/auth/profile", "PATCH", { new_password: "12345678" }),
        no_context,
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error.details).toEqual({
        current_password: ["Informe a senha atual para alterar e-mail ou senha"],
      });
    });
  });
});
