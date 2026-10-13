import { describe, expect, it } from "vitest";
import { AppError, not_found_error, unauthorized_error } from "@/lib/errors";

describe("errors", () => {
  it("AppError keeps status, code, message and details", () => {
    const error = new AppError(422, "NEGATIVE_BALANCE", "Saldo negativo", { balance: -1 });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.status).toBe(422);
    expect(error.code).toBe("NEGATIVE_BALANCE");
    expect(error.message).toBe("Saldo negativo");
    expect(error.details).toEqual({ balance: -1 });
  });

  it("not_found_error builds a 404 with default and custom messages", () => {
    expect(not_found_error()).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Recurso não encontrado",
    });
    expect(not_found_error("Carteira não encontrada").message).toBe("Carteira não encontrada");
  });

  it("unauthorized_error builds a 401 with default and custom messages", () => {
    expect(unauthorized_error()).toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Não autenticado",
    });
    expect(unauthorized_error("Sessão expirada").message).toBe("Sessão expirada");
  });
});
