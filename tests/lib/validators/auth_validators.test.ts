import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  forgot_password_schema,
  reset_password_schema,
  sign_in_schema,
  sign_up_schema,
  update_profile_schema,
} from "@/lib/validators/auth_validators";

function field_errors(schema: z.ZodType, input: unknown): Record<string, string[] | undefined> {
  const result = schema.safeParse(input);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

describe("auth_validators", () => {
  describe("sign_up_schema", () => {
    it("normalizes name and e-mail", () => {
      expect(
        sign_up_schema.parse({ name: "  Maria  ", email: "MARIA@Example.com", password: "12345678" }),
      ).toEqual({ name: "Maria", email: "maria@example.com", password: "12345678" });
    });

    it("rejects short names, invalid e-mails and short passwords", () => {
      expect(field_errors(sign_up_schema, { name: "M", email: "invalid", password: "123" })).toEqual({
        name: ["Informe ao menos 2 caracteres"],
        email: ["E-mail inválido"],
        password: ["A senha deve ter ao menos 8 caracteres"],
      });
    });

    it("rejects long names and passwords", () => {
      const errors = field_errors(sign_up_schema, {
        name: "a".repeat(101),
        email: "maria@example.com",
        password: "a".repeat(73),
      });
      expect(errors).toEqual({
        name: ["Nome muito longo"],
        password: ["A senha deve ter no máximo 72 caracteres"],
      });
    });

    it("rejects e-mails longer than 254 characters", () => {
      const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.com`;
      expect(field_errors(sign_up_schema, { name: "Maria", email, password: "12345678" }).email).toContain(
        "E-mail muito longo",
      );
    });
  });

  describe("sign_in_schema", () => {
    it("requires a password", () => {
      expect(field_errors(sign_in_schema, { email: "maria@example.com", password: "" })).toEqual({
        password: ["Informe a senha"],
      });
    });

    it("accepts any non-empty password", () => {
      expect(sign_in_schema.parse({ email: "maria@example.com", password: "x" })).toEqual({
        email: "maria@example.com",
        password: "x",
      });
    });
  });

  it("forgot_password_schema validates the e-mail", () => {
    expect(forgot_password_schema.safeParse({ email: "x" }).success).toBe(false);
    expect(forgot_password_schema.parse({ email: "X@Y.com" })).toEqual({ email: "x@y.com" });
  });

  it("reset_password_schema requires token and a valid password", () => {
    expect(field_errors(reset_password_schema, { token: "", password: "123" })).toEqual({
      token: ["Token ausente"],
      password: ["A senha deve ter ao menos 8 caracteres"],
    });
    expect(reset_password_schema.parse({ token: "abc", password: "12345678" })).toEqual({
      token: "abc",
      password: "12345678",
    });
  });

  describe("update_profile_schema", () => {
    it("accepts a name-only change without the current password", () => {
      expect(update_profile_schema.parse({ name: "Maria" })).toEqual({ name: "Maria" });
      expect(update_profile_schema.parse({})).toEqual({});
    });

    it("requires the current password to change the e-mail", () => {
      expect(field_errors(update_profile_schema, { email: "new@example.com" })).toEqual({
        current_password: ["Informe a senha atual para alterar e-mail ou senha"],
      });
    });

    it("requires the current password to change the password", () => {
      expect(field_errors(update_profile_schema, { new_password: "12345678" })).toEqual({
        current_password: ["Informe a senha atual para alterar e-mail ou senha"],
      });
    });

    it("accepts sensitive changes with the current password", () => {
      expect(
        update_profile_schema.parse({
          email: "NEW@example.com",
          new_password: "12345678",
          current_password: "old",
        }),
      ).toEqual({ email: "new@example.com", new_password: "12345678", current_password: "old" });
    });
  });
});
