import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const global_for_prisma = globalThis as unknown as {
  prisma_client?: PrismaClient;
};

function create_prisma_client(): PrismaClient {
  const connection_string = process.env.DATABASE_URL;
  if (!connection_string) {
    throw new Error("DATABASE_URL is not defined");
  }
  const adapter = new PrismaPg({ connectionString: connection_string });
  return new PrismaClient({ adapter });
}

export const prisma = global_for_prisma.prisma_client ?? create_prisma_client();

if (process.env.NODE_ENV !== "production") {
  global_for_prisma.prisma_client = prisma;
}
