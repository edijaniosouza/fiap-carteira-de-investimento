import { z } from "zod";

const email_schema = z
  .email("E-mail inválido")
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo");

const password_schema = z
  .string()
  .min(8, "A senha deve ter ao menos 8 caracteres")
  .max(72, "A senha deve ter no máximo 72 caracteres");

const name_schema = z
  .string()
  .trim()
  .min(2, "Informe ao menos 2 caracteres")
  .max(100, "Nome muito longo");

export const sign_up_schema = z.object({
  name: name_schema,
  email: email_schema,
  password: password_schema,
});

export const sign_in_schema = z.object({
  email: email_schema,
  password: z.string().min(1, "Informe a senha"),
});

export const forgot_password_schema = z.object({
  email: email_schema,
});

export const reset_password_schema = z.object({
  token: z.string().min(1, "Token ausente"),
  password: password_schema,
});

export const update_profile_schema = z
  .object({
    name: name_schema.optional(),
    email: email_schema.optional(),
    current_password: z.string().optional(),
    new_password: password_schema.optional(),
  })
  .refine((data) => !(data.new_password || data.email) || Boolean(data.current_password), {
    message: "Informe a senha atual para alterar e-mail ou senha",
    path: ["current_password"],
  });
