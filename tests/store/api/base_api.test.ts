import { beforeEach, describe, expect, it, vi } from "vitest";
import { build_user_dto } from "../../support/factories";
import { type FetchMock, json_response, stub_fetch } from "../../support/store_helpers";
import { auth_api } from "@/store/api/auth_api";
import { get_error_message, get_field_errors } from "@/store/api/base_api";
import { session_started } from "@/store/slices/session_slice";
import { make_store } from "@/store/store";

describe("base_api", () => {
  describe("get_error_message", () => {
    it("extracts the API error message", () => {
      expect(get_error_message({ status: 400, data: { error: { code: "X", message: "Mensagem" } } })).toBe("Mensagem");
    });

    it("falls back for unknown errors", () => {
      expect(get_error_message(undefined)).toBe("Algo deu errado. Tente novamente.");
      expect(get_error_message("boom")).toBe("Algo deu errado. Tente novamente.");
      expect(get_error_message({ status: "FETCH_ERROR", data: "x" })).toBe("Algo deu errado. Tente novamente.");
      expect(get_error_message({ data: null }, "Outra")).toBe("Outra");
    });
  });

  describe("get_field_errors", () => {
    it("returns validation details", () => {
      const error = {
        status: 400,
        data: { error: { code: "VALIDATION_ERROR", message: "x", details: { name: ["Curto"] } } },
      };
      expect(get_field_errors(error)).toEqual({ name: ["Curto"] });
    });

    it("returns an empty object when there are no details", () => {
      expect(get_field_errors({ data: { error: { code: "X", message: "x" } } })).toEqual({});
      expect(get_field_errors({ data: { error: { code: "X", message: "x", details: "text" } } })).toEqual({});
      expect(get_field_errors({ data: "x" })).toEqual({});
      expect(get_field_errors(null)).toEqual({});
    });
  });

  describe("session handling", () => {
    let fetch_mock: FetchMock;
    const location = { pathname: "/dashboard", assign: vi.fn() };

    beforeEach(() => {
      fetch_mock = stub_fetch();
      location.pathname = "/dashboard";
      vi.stubGlobal("window", { location });
    });

    function store_with_user() {
      const store = make_store();
      store.dispatch(session_started(build_user_dto()));
      return store;
    }

    it("clears the session and redirects on 401 UNAUTHORIZED", async () => {
      fetch_mock.mockResolvedValue(json_response({ error: { code: "UNAUTHORIZED", message: "Não autenticado" } }, 401));
      const store = store_with_user();

      await store.dispatch(auth_api.endpoints.getProfile.initiate());

      expect(store.getState().session.current_user).toBeNull();
      expect(location.assign).toHaveBeenCalledWith("/sign_in");
    });

    it("does not redirect when already on the sign in page", async () => {
      location.pathname = "/sign_in";
      fetch_mock.mockResolvedValue(json_response({ error: { code: "UNAUTHORIZED", message: "x" } }, 401));
      const store = store_with_user();

      await store.dispatch(auth_api.endpoints.getProfile.initiate());

      expect(store.getState().session.current_user).toBeNull();
      expect(location.assign).not.toHaveBeenCalled();
    });

    it("does not redirect outside the browser", async () => {
      vi.stubGlobal("window", undefined);
      fetch_mock.mockResolvedValue(json_response({ error: { code: "UNAUTHORIZED", message: "x" } }, 401));
      const store = store_with_user();

      await store.dispatch(auth_api.endpoints.getProfile.initiate());

      expect(store.getState().session.current_user).toBeNull();
      expect(location.assign).not.toHaveBeenCalled();
    });

    it("keeps the session on other 401 errors (wrong credentials)", async () => {
      fetch_mock.mockResolvedValue(json_response({ error: { code: "INVALID_CREDENTIALS", message: "x" } }, 401));
      const store = store_with_user();

      const result = await store.dispatch(
        auth_api.endpoints.signIn.initiate({ email: "maria@example.com", password: "x" }),
      );

      expect(result.error).toMatchObject({ status: 401 });
      expect(store.getState().session.current_user).not.toBeNull();
      expect(location.assign).not.toHaveBeenCalled();
    });

    it("keeps the session on non JSON errors", async () => {
      fetch_mock.mockResolvedValue(new Response("Server error", { status: 500 }));
      const store = store_with_user();

      await store.dispatch(auth_api.endpoints.getProfile.initiate());

      expect(store.getState().session.current_user).not.toBeNull();
    });
  });
});
