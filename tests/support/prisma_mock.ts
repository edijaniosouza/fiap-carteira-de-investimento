import { type Mock, vi } from "vitest";

type MockedDelegate<K extends string> = Record<K, Mock>;

export type PrismaMock = {
  user: MockedDelegate<"findUnique" | "create" | "update">;
  passwordResetToken: MockedDelegate<"create" | "findUnique" | "updateMany">;
  portfolio: MockedDelegate<
    "findFirst" | "findMany" | "count" | "create" | "update" | "delete" | "findUniqueOrThrow"
  >;
  asset: MockedDelegate<"count" | "findMany" | "findUnique" | "findUniqueOrThrow">;
  transaction: MockedDelegate<"findMany" | "findFirst" | "create" | "update" | "delete">;
  quote: MockedDelegate<"findUnique" | "upsert">;
  $transaction: Mock;
  $queryRaw: Mock;
};

/**
 * In-memory stand-in for the Prisma client. `$transaction` runs callbacks with the same
 * mock as the transaction client and resolves arrays of promises, like Prisma does.
 */
export function create_prisma_mock(): PrismaMock {
  const prisma_mock = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    passwordResetToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    portfolio: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    asset: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    transaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    quote: { findUnique: vi.fn(), upsert: vi.fn() },
    $queryRaw: vi.fn(),
  } as Omit<PrismaMock, "$transaction">;

  const $transaction = vi.fn((arg: unknown) =>
    typeof arg === "function" ? arg(prisma_mock) : Promise.all(arg as Promise<unknown>[]),
  );
  return { ...prisma_mock, $transaction } as PrismaMock;
}
