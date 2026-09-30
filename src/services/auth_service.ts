import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { z } from "zod";
import type { User } from "@/generated/prisma/client";
import { hash_password, verify_password } from "@/lib/auth/password";
import { AppError, not_found_error } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type {
  reset_password_schema,
  sign_in_schema,
  sign_up_schema,
  update_profile_schema,
} from "@/lib/validators/auth_validators";
import type { UserDto } from "@/types/api";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function to_user_dto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at.toISOString(),
  };
}

function hash_reset_token(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function sign_up(input: z.infer<typeof sign_up_schema>): Promise<UserDto> {
  const existing_user = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing_user) {
    throw new AppError(409, "EMAIL_IN_USE", "Já existe uma conta com este e-mail");
  }
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password_hash: await hash_password(input.password),
    },
  });
  return to_user_dto(user);
}

export async function sign_in(input: z.infer<typeof sign_in_schema>): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const is_valid = user ? await verify_password(input.password, user.password_hash) : false;
  if (!user || !is_valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos");
  }
  return to_user_dto(user);
}

/**
 * Mock e-mail delivery: the reset link is logged in the server console.
 * Always resolves silently to avoid leaking which e-mails are registered.
 */
export async function request_password_reset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return;
  }
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      user_id: user.id,
      token_hash: hash_reset_token(token),
      expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  const app_url = process.env.APP_URL ?? "http://localhost:3000";
  console.info(
    `[auth] password reset requested for ${user.email}: ${app_url}/reset_password?token=${token}`,
  );
}

export async function reset_password(input: z.infer<typeof reset_password_schema>): Promise<void> {
  const reset_token = await prisma.passwordResetToken.findUnique({
    where: { token_hash: hash_reset_token(input.token) },
  });
  if (!reset_token || reset_token.used_at || reset_token.expires_at < new Date()) {
    throw new AppError(400, "INVALID_TOKEN", "Link de recuperação inválido ou expirado");
  }
  const password_hash = await hash_password(input.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset_token.user_id }, data: { password_hash } }),
    prisma.passwordResetToken.updateMany({
      where: { user_id: reset_token.user_id, used_at: null },
      data: { used_at: new Date() },
    }),
  ]);
}

export async function get_user(user_id: string): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id: user_id } });
  if (!user) {
    throw not_found_error("Usuário não encontrado");
  }
  return to_user_dto(user);
}

export async function find_user(user_id: string): Promise<UserDto | null> {
  const user = await prisma.user.findUnique({ where: { id: user_id } });
  return user ? to_user_dto(user) : null;
}

export async function update_profile(
  user_id: string,
  input: z.infer<typeof update_profile_schema>,
): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id: user_id } });
  if (!user) {
    throw not_found_error("Usuário não encontrado");
  }

  const is_sensitive_change = Boolean(input.new_password) || (input.email && input.email !== user.email);
  if (is_sensitive_change) {
    const is_valid = await verify_password(input.current_password ?? "", user.password_hash);
    if (!is_valid) {
      throw new AppError(400, "INVALID_CREDENTIALS", "Senha atual incorreta", {
        current_password: ["Senha atual incorreta"],
      });
    }
  }

  if (input.email && input.email !== user.email) {
    const email_owner = await prisma.user.findUnique({ where: { email: input.email } });
    if (email_owner) {
      throw new AppError(409, "EMAIL_IN_USE", "Já existe uma conta com este e-mail");
    }
  }

  const updated_user = await prisma.user.update({
    where: { id: user_id },
    data: {
      name: input.name ?? undefined,
      email: input.email ?? undefined,
      password_hash: input.new_password ? await hash_password(input.new_password) : undefined,
    },
  });
  return to_user_dto(updated_user);
}
