import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import {
  handle_route_error,
  json_error,
  json_no_content,
  json_ok,
  parse_json_body,
  parse_search_params,
  with_error_handling,
} from "@/lib/http";

describe("http", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("json_ok", () => {
    it("returns JSON with status 200 by default", async () => {
      const response = json_ok({ ok: true });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    });

    it("accepts a custom status", () => {
      expect(json_ok({}, 201).status).toBe(201);
    });
  });

  it("json_no_content returns an empty 204", async () => {
    const response = json_no_content();
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("json_error wraps code, message and details", async () => {
    const response = json_error(409, "EMAIL_IN_USE", "Em uso", { field: ["x"] });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "EMAIL_IN_USE", message: "Em uso", details: { field: ["x"] } },
    });
  });

  describe("handle_route_error", () => {
    it("maps AppError to its status and code", async () => {
      const response = handle_route_error(new AppError(403, "FORBIDDEN", "Proibido", { a: 1 }));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: { code: "FORBIDDEN", message: "Proibido", details: { a: 1 } },
      });
    });

    it("maps ZodError to a 400 with field errors", async () => {
      const result = z.object({ name: z.string().min(2, "Curto") }).safeParse({ name: "a" });
      const response = handle_route_error(result.error);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: { name: ["Curto"] } },
      });
    });

    it("maps unknown errors to a 500 and logs them", async () => {
      const console_error = vi.spyOn(console, "error").mockImplementation(() => {});
      const response = handle_route_error(new Error("boom"));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
      });
      expect(console_error).toHaveBeenCalledWith("[api] unexpected error", expect.any(Error));
    });
  });

  describe("with_error_handling", () => {
    const request = new NextRequest("http://localhost/api/test");

    it("returns the handler response and forwards request and context", async () => {
      const handler = vi.fn(async () => json_ok({ ok: true }));
      const wrapped = with_error_handling(handler);
      const response = await wrapped(request, { params: "ctx" });
      expect(handler).toHaveBeenCalledWith(request, { params: "ctx" });
      expect(response.status).toBe(200);
    });

    it("converts thrown errors into error responses", async () => {
      const wrapped = with_error_handling(async () => {
        throw new AppError(404, "NOT_FOUND", "Não encontrado");
      });
      const response = await wrapped(request, undefined);
      expect(response.status).toBe(404);
    });
  });

  describe("parse_json_body", () => {
    const schema = z.object({ name: z.string() });

    it("parses a valid body", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "Carteira" }),
      });
      await expect(parse_json_body(request, schema)).resolves.toEqual({ name: "Carteira" });
    });

    it("throws INVALID_JSON for malformed JSON", async () => {
      const request = new Request("http://localhost", { method: "POST", body: "{invalid" });
      await expect(parse_json_body(request, schema)).rejects.toMatchObject({
        status: 400,
        code: "INVALID_JSON",
      });
    });

    it("throws a ZodError when the body does not match the schema", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: 1 }),
      });
      await expect(parse_json_body(request, schema)).rejects.toBeInstanceOf(z.ZodError);
    });
  });

  it("parse_search_params validates the query string", () => {
    const request = new NextRequest("http://localhost/api/catalog?page=2&q=petr");
    const schema = z.object({ page: z.coerce.number(), q: z.string() });
    expect(parse_search_params(request, schema)).toEqual({ page: 2, q: "petr" });
  });
});
