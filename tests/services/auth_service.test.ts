import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { build_user } from "../support/factories";
import type { PrismaMock } from "../support/prisma_mock";

vi.mock("@/lib/prisma", async () => {
  const { create_prisma_mock } = await import("../support/prisma_mock");
  return { prisma: create_prisma_mock() };
});
vi.mock("@/lib/auth/password", () => ({
  hash_password: vi.fn(async (password: string) => `hashed:${password}`),
  verify_password: vi.fn(),
}));

import { hash_password, verify_password } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import {
  find_user,
  get_user,
  request_password_reset,
  reset_password,
  sign_in,
  sign_up,
  to_user_dto,
  update_profile,
} from "@/services/auth_service";

const prisma_mock = prisma as unknown as PrismaMock;

const user = build_user();
const user_dto = {
  id: "user_1",
  name: "Maria Silva",
  email: "maria@example.com",
  created_at: "2026-01-10T12:00:00.000Z",
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("auth_service", () => {
  it("to_user_dto hides the password hash", () => {
    expect(to_user_dto(user)).toEqual(user_dto);
  });

  describe("sign_up", () => {
    const input = { name: "Maria Silva", email: "maria@example.com", password: "12345678" };

    it("creates the user with a hashed password", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(null);
      prisma_mock.user.create.mockResolvedValue(user);

      await expect(sign_up(input)).resolves.toEqual(user_dto);
      expect(hash_password).toHaveBeenCalledWith("12345678");
      expect(prisma_mock.user.create).toHaveBeenCalledWith({
        data: { name: "Maria Silva", email: "maria@example.com", password_hash: "hashed:12345678" },
      });
    });

    it("rejects duplicated e-mails", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(user);

      await expect(sign_up(input)).rejects.toMatchObject({ status: 409, code: "EMAIL_IN_USE" });
      expect(prisma_mock.user.create).not.toHaveBeenCalled();
    });
  });

  describe("sign_in", () => {
    const input = { email: "maria@example.com", password: "12345678" };

    it("returns the user for valid credentials", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(user);
      vi.mocked(verify_password).mockResolvedValue(true);

      await expect(sign_in(input)).resolves.toEqual(user_dto);
      expect(verify_password).toHaveBeenCalledWith("12345678", "hashed_password");
    });

    it("rejects a wrong password", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(user);
      vi.mocked(verify_password).mockResolvedValue(false);

      await expect(sign_in(input)).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    });

    it("rejects unknown e-mails without checking the password", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(null);

      await expect(sign_in(input)).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
      expect(verify_password).not.toHaveBeenCalled();
    });
  });

  describe("request_password_reset", () => {
    beforeEach(() => {
      vi.spyOn(console, "info").mockImplementation(() => {});
    });

    it("silently ignores unknown e-mails", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(null);

      await expect(request_password_reset("ghost@example.com")).resolves.toBeUndefined();
      expect(prisma_mock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
    });

    it("stores the token hash with a 1 hour TTL and logs the link", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
      vi.stubEnv("APP_URL", "https://carteira.test");
      prisma_mock.user.findUnique.mockResolvedValue(user);

      try {
        await request_password_reset("maria@example.com");
      } finally {
        vi.useRealTimers();
      }

      const log_message = vi.mocked(console.info).mock.calls[0][0] as string;
      const token = new URL(log_message.split(": ")[1]).searchParams.get("token") as string;
      expect(log_message).toContain("password reset requested for maria@example.com");
      expect(log_message).toContain("https://carteira.test/reset_password?token=");
      expect(prisma_mock.passwordResetToken.create).toHaveBeenCalledWith({
        data: {
          user_id: "user_1",
          token_hash: sha256(token),
          expires_at: new Date("2026-10-13T13:00:00.000Z"),
        },
      });
    });

    it("uses localhost when APP_URL is not set", async () => {
      vi.stubEnv("APP_URL", undefined);
      prisma_mock.user.findUnique.mockResolvedValue(user);

      await request_password_reset("maria@example.com");

      expect(vi.mocked(console.info).mock.calls[0][0]).toContain("http://localhost:3000/reset_password?token=");
    });
  });

  describe("reset_password", () => {
    const valid_token = {
      id: "token_1",
      user_id: "user_1",
      token_hash: sha256("raw_token"),
      expires_at: new Date(Date.now() + 60_000),
      used_at: null,
    };

    it("updates the password and invalidates every pending token", async () => {
      prisma_mock.passwordResetToken.findUnique.mockResolvedValue(valid_token);
      prisma_mock.user.update.mockResolvedValue(user);
      prisma_mock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(reset_password({ token: "raw_token", password: "new_password" })).resolves.toBeUndefined();

      expect(prisma_mock.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { token_hash: sha256("raw_token") },
      });
      expect(prisma_mock.user.update).toHaveBeenCalledWith({
        where: { id: "user_1" },
        data: { password_hash: "hashed:new_password" },
      });
      expect(prisma_mock.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { user_id: "user_1", used_at: null },
        data: { used_at: expect.any(Date) },
      });
      expect(prisma_mock.$transaction).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["unknown", null],
      ["already used", { ...valid_token, used_at: new Date() }],
      ["expired", { ...valid_token, expires_at: new Date(Date.now() - 1000) }],
    ])("rejects %s tokens", async (_label, token) => {
      prisma_mock.passwordResetToken.findUnique.mockResolvedValue(token);

      await expect(reset_password({ token: "raw_token", password: "new_password" })).rejects.toMatchObject({
        status: 400,
        code: "INVALID_TOKEN",
      });
      expect(prisma_mock.user.update).not.toHaveBeenCalled();
    });
  });

  describe("get_user / find_user", () => {
    it("get_user returns the DTO", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(user);
      await expect(get_user("user_1")).resolves.toEqual(user_dto);
      expect(prisma_mock.user.findUnique).toHaveBeenCalledWith({ where: { id: "user_1" } });
    });

    it("get_user throws 404 for unknown users", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(null);
      await expect(get_user("ghost")).rejects.toMatchObject({ status: 404, message: "Usuário não encontrado" });
    });

    it("find_user returns the DTO or null", async () => {
      prisma_mock.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
      await expect(find_user("user_1")).resolves.toEqual(user_dto);
      await expect(find_user("ghost")).resolves.toBeNull();
    });
  });

  describe("update_profile", () => {
    beforeEach(() => {
      prisma_mock.user.update.mockImplementation(async ({ data }) => ({ ...user, ...data }));
    });

    it("throws 404 for unknown users", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(null);
      await expect(update_profile("ghost", { name: "X" })).rejects.toMatchObject({ status: 404 });
    });

    it("updates the name without asking for the password", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(user);

      await expect(update_profile("user_1", { name: "Maria Souza" })).resolves.toMatchObject({
        name: "Maria Souza",
      });
      expect(verify_password).not.toHaveBeenCalled();
      expect(prisma_mock.user.update).toHaveBeenCalledWith({
        where: { id: "user_1" },
        data: { name: "Maria Souza", email: undefined, password_hash: undefined },
      });
    });

    it("does not require the password when the e-mail is unchanged", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(user);

      await update_profile("user_1", { email: "maria@example.com" });

      expect(verify_password).not.toHaveBeenCalled();
      expect(prisma_mock.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it("rejects sensitive changes with a wrong current password", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(user);
      vi.mocked(verify_password).mockResolvedValue(false);

      await expect(update_profile("user_1", { new_password: "12345678" })).rejects.toMatchObject({
        status: 400,
        code: "INVALID_CREDENTIALS",
        details: { current_password: ["Senha atual incorreta"] },
      });
      expect(verify_password).toHaveBeenCalledWith("", "hashed_password");
      expect(prisma_mock.user.update).not.toHaveBeenCalled();
    });

    it("changes the password after verifying the current one", async () => {
      prisma_mock.user.findUnique.mockResolvedValue(user);
      vi.mocked(verify_password).mockResolvedValue(true);

      await update_profile("user_1", { current_password: "old", new_password: "12345678" });

      expect(verify_password).toHaveBeenCalledWith("old", "hashed_password");
      expect(prisma_mock.user.update).toHaveBeenCalledWith({
        where: { id: "user_1" },
        data: { name: undefined, email: undefined, password_hash: "hashed:12345678" },
      });
    });

    it("rejects an e-mail that belongs to another account", async () => {
      prisma_mock.user.findUnique
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(build_user({ id: "user_2", email: "other@example.com" }));
      vi.mocked(verify_password).mockResolvedValue(true);

      await expect(
        update_profile("user_1", { email: "other@example.com", current_password: "old" }),
      ).rejects.toMatchObject({ status: 409, code: "EMAIL_IN_USE" });
    });

    it("changes the e-mail when it is available", async () => {
      prisma_mock.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
      vi.mocked(verify_password).mockResolvedValue(true);

      await expect(
        update_profile("user_1", { email: "new@example.com", current_password: "old" }),
      ).resolves.toMatchObject({ email: "new@example.com" });
      expect(prisma_mock.user.findUnique).toHaveBeenLastCalledWith({ where: { email: "new@example.com" } });
    });
  });
});
