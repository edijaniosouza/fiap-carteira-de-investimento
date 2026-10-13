import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma_pg = vi.hoisted(() => vi.fn());
const prisma_client = vi.hoisted(() => vi.fn());

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(options: unknown) {
      prisma_pg(options);
    }
  },
}));

vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: class {
    readonly options: unknown;
    constructor(options: unknown) {
      this.options = options;
      prisma_client(options);
    }
  },
}));

const global_for_prisma = globalThis as unknown as { prisma_client?: unknown };

describe("prisma", () => {
  beforeEach(() => {
    vi.resetModules();
    delete global_for_prisma.prisma_client;
  });

  it("throws when DATABASE_URL is not defined", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(import("@/lib/prisma")).rejects.toThrow("DATABASE_URL is not defined");
  });

  it("creates a client with the pg adapter and caches it outside production", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/db");
    vi.stubEnv("NODE_ENV", "development");

    const { prisma } = await import("@/lib/prisma");

    expect(prisma_pg).toHaveBeenCalledWith({ connectionString: "postgres://localhost/db" });
    expect(prisma_client).toHaveBeenCalledWith({ adapter: expect.any(Object) });
    expect(global_for_prisma.prisma_client).toBe(prisma);
  });

  it("reuses the cached client", async () => {
    const cached_client = { cached: true };
    global_for_prisma.prisma_client = cached_client;

    const { prisma } = await import("@/lib/prisma");

    expect(prisma).toBe(cached_client);
    expect(prisma_client).not.toHaveBeenCalled();
  });

  it("does not cache the client in production", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/db");
    vi.stubEnv("NODE_ENV", "production");

    await import("@/lib/prisma");

    expect(global_for_prisma.prisma_client).toBeUndefined();
  });
});
