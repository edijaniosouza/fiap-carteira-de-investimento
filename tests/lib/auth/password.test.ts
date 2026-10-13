import { describe, expect, it } from "vitest";
import { hash_password, verify_password } from "@/lib/auth/password";

describe("password", () => {
  it("hashes with bcrypt and verifies the original password", async () => {
    const password_hash = await hash_password("super-secret");

    expect(password_hash).not.toBe("super-secret");
    expect(password_hash).toMatch(/^\$2[aby]\$10\$/);
    await expect(verify_password("super-secret", password_hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const password_hash = await hash_password("super-secret");
    await expect(verify_password("wrong-secret", password_hash)).resolves.toBe(false);
  });
});
