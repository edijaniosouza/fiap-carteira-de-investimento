import { beforeEach, describe, expect, it, vi } from "vitest";
import { build_asset, build_portfolio, build_transaction } from "../support/factories";
import type { PrismaMock } from "../support/prisma_mock";

vi.mock("@/lib/prisma", async () => {
  const { create_prisma_mock } = await import("../support/prisma_mock");
  return { prisma: create_prisma_mock() };
});
vi.mock("@/services/catalog_service", async (import_original) => ({
  ...(await import_original<typeof import("@/services/catalog_service")>()),
  get_investable_asset: vi.fn(),
}));
vi.mock("@/services/portfolio_service", () => ({ get_owned_portfolio: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { get_investable_asset } from "@/services/catalog_service";
import { get_owned_portfolio } from "@/services/portfolio_service";
import {
  create_transaction,
  delete_transaction,
  list_transactions,
  update_transaction,
} from "@/services/transaction_service";

const prisma_mock = prisma as unknown as PrismaMock;

const petr = build_asset({ id: "petr", code: "PETR4" });
const vale = build_asset({ id: "vale", code: "VALE3" });

const buy = build_transaction({
  id: "buy_1",
  asset_id: "petr",
  type: "BUY",
  quantity: 10,
  unit_price: 30,
  trade_date: new Date("2026-03-01T00:00:00.000Z"),
});

describe("transaction_service", () => {
  beforeEach(() => {
    vi.mocked(get_owned_portfolio).mockResolvedValue(build_portfolio());
    vi.mocked(get_investable_asset).mockImplementation(async (asset_id) => (asset_id === "vale" ? vale : petr));
    prisma_mock.$queryRaw.mockResolvedValue([]);
  });

  describe("list_transactions", () => {
    it("lists transactions newest first as DTOs", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([{ ...buy, unit_price: 33.333 as never, asset: petr }]);

      await expect(list_transactions("user_1", "portfolio_1")).resolves.toEqual([
        {
          id: "buy_1",
          portfolio_id: "portfolio_1",
          asset: { id: "petr", code: "PETR4", name: "Petrobras PN", type: "STOCK", indexer: null, rate: null },
          type: "BUY",
          quantity: 10,
          unit_price: 33.333,
          total: 333.33,
          trade_date: "2026-03-01",
          created_at: "2026-03-01T10:00:00.000Z",
        },
      ]);
      expect(get_owned_portfolio).toHaveBeenCalledWith("user_1", "portfolio_1");
      expect(prisma_mock.transaction.findMany).toHaveBeenCalledWith({
        where: { portfolio_id: "portfolio_1" },
        include: { asset: true },
        orderBy: [{ trade_date: "desc" }, { created_at: "desc" }],
      });
    });

    it("propagates ownership errors", async () => {
      vi.mocked(get_owned_portfolio).mockRejectedValue(new Error("not found"));
      await expect(list_transactions("user_2", "portfolio_1")).rejects.toThrow("not found");
      expect(prisma_mock.transaction.findMany).not.toHaveBeenCalled();
    });
  });

  describe("create_transaction", () => {
    const input = {
      asset_id: "petr",
      type: "SELL" as const,
      quantity: 5,
      unit_price: 40,
      trade_date: "2026-04-01",
    };

    it("locks the portfolio, validates the timeline and creates the transaction", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([buy]);
      prisma_mock.transaction.create.mockImplementation(async ({ data }) => ({
        ...build_transaction({ id: "new", ...data }),
        asset: petr,
      }));

      const created = await create_transaction("user_1", "portfolio_1", input);

      expect(prisma_mock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma_mock.transaction.findMany).toHaveBeenCalledWith({
        where: { portfolio_id: "portfolio_1", asset_id: "petr" },
      });
      expect(prisma_mock.transaction.create).toHaveBeenCalledWith({
        data: {
          portfolio_id: "portfolio_1",
          asset_id: "petr",
          type: "SELL",
          quantity: 5,
          unit_price: 40,
          trade_date: new Date("2026-04-01T00:00:00.000Z"),
        },
        include: { asset: true },
      });
      expect(created).toMatchObject({ id: "new", type: "SELL", quantity: 5, total: 200, trade_date: "2026-04-01" });
    });

    it("rejects sells that would make the balance negative", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([buy]);

      await expect(
        create_transaction("user_1", "portfolio_1", { ...input, quantity: 11 }),
      ).rejects.toMatchObject({
        status: 422,
        code: "NEGATIVE_BALANCE",
        message: "Operação deixaria a quantidade de PETR4 negativa em 01/04/2026",
        details: { asset_code: "PETR4", trade_date: "2026-04-01", balance: -1 },
      });
      expect(prisma_mock.transaction.create).not.toHaveBeenCalled();
    });

    it("rejects sells dated before the purchase", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([buy]);

      await expect(
        create_transaction("user_1", "portfolio_1", { ...input, trade_date: "2026-02-01" }),
      ).rejects.toMatchObject({ code: "NEGATIVE_BALANCE", details: { trade_date: "2026-02-01", balance: -5 } });
    });

    it("propagates asset validation errors", async () => {
      vi.mocked(get_investable_asset).mockRejectedValue(new Error("Ativo não encontrado"));
      await expect(create_transaction("user_1", "portfolio_1", input)).rejects.toThrow("Ativo não encontrado");
      expect(prisma_mock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("update_transaction", () => {
    beforeEach(() => {
      prisma_mock.transaction.update.mockImplementation(async ({ where, data }) => ({
        ...build_transaction({ id: where.id, ...data, unit_price: data.unit_price ?? 30 }),
        asset: data.asset_id === "vale" ? vale : petr,
      }));
    });

    it("throws 404 when the transaction is not in the portfolio", async () => {
      prisma_mock.transaction.findFirst.mockResolvedValue(null);

      await expect(update_transaction("user_1", "portfolio_1", "ghost", { quantity: 1 })).rejects.toMatchObject({
        status: 404,
        message: "Transação não encontrada",
      });
      expect(prisma_mock.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: "ghost", portfolio_id: "portfolio_1" },
      });
    });

    it("keeps current values for omitted fields", async () => {
      prisma_mock.transaction.findFirst.mockResolvedValue(buy);
      prisma_mock.transaction.findMany.mockResolvedValue([buy]);

      const updated = await update_transaction("user_1", "portfolio_1", "buy_1", { unit_price: 31 });

      expect(get_investable_asset).toHaveBeenCalledWith("petr");
      expect(prisma_mock.transaction.update).toHaveBeenCalledWith({
        where: { id: "buy_1" },
        data: {
          asset_id: "petr",
          type: "BUY",
          quantity: 10,
          unit_price: 31,
          trade_date: new Date("2026-03-01T00:00:00.000Z"),
        },
        include: { asset: true },
      });
      expect(updated).toMatchObject({ id: "buy_1", unit_price: 31 });
      expect(prisma_mock.asset.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("applies new type, quantity and date", async () => {
      prisma_mock.transaction.findFirst.mockResolvedValue(buy);
      prisma_mock.transaction.findMany.mockResolvedValue([buy]);

      await update_transaction("user_1", "portfolio_1", "buy_1", {
        type: "BUY",
        quantity: 20,
        trade_date: "2026-02-15",
      });

      expect(prisma_mock.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 20,
            unit_price: undefined,
            trade_date: new Date("2026-02-15T00:00:00.000Z"),
          }),
        }),
      );
    });

    it("rejects edits that make a later sell go negative", async () => {
      const sell = build_transaction({
        id: "sell_1",
        asset_id: "petr",
        type: "SELL",
        quantity: 8,
        trade_date: new Date("2026-05-01T00:00:00.000Z"),
      });
      prisma_mock.transaction.findFirst.mockResolvedValue(buy);
      prisma_mock.transaction.findMany.mockResolvedValue([buy, sell]);

      await expect(
        update_transaction("user_1", "portfolio_1", "buy_1", { quantity: 5 }),
      ).rejects.toMatchObject({ code: "NEGATIVE_BALANCE", details: { trade_date: "2026-05-01", balance: -3 } });
      expect(prisma_mock.transaction.update).not.toHaveBeenCalled();
    });

    it("validates both timelines when moving to another asset", async () => {
      prisma_mock.transaction.findFirst.mockResolvedValue(buy);
      prisma_mock.transaction.findMany.mockImplementation(async ({ where }) => (where.asset_id === "petr" ? [buy] : []));
      prisma_mock.asset.findUniqueOrThrow.mockResolvedValue(petr);

      const updated = await update_transaction("user_1", "portfolio_1", "buy_1", { asset_id: "vale" });

      expect(get_investable_asset).toHaveBeenCalledWith("vale");
      expect(prisma_mock.asset.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "petr" } });
      expect(prisma_mock.transaction.findMany).toHaveBeenCalledWith({
        where: { portfolio_id: "portfolio_1", asset_id: "vale" },
      });
      expect(prisma_mock.transaction.findMany).toHaveBeenCalledWith({
        where: { portfolio_id: "portfolio_1", asset_id: "petr" },
      });
      expect(updated.asset.code).toBe("VALE3");
    });

    it("rejects moving a buy away when the old asset has sells", async () => {
      const sell = build_transaction({
        id: "sell_1",
        asset_id: "petr",
        type: "SELL",
        quantity: 4,
        trade_date: new Date("2026-05-01T00:00:00.000Z"),
      });
      prisma_mock.transaction.findFirst.mockResolvedValue(buy);
      prisma_mock.transaction.findMany.mockImplementation(async ({ where }) =>
        where.asset_id === "petr" ? [buy, sell] : [],
      );
      prisma_mock.asset.findUniqueOrThrow.mockResolvedValue(petr);

      await expect(
        update_transaction("user_1", "portfolio_1", "buy_1", { asset_id: "vale" }),
      ).rejects.toMatchObject({ code: "NEGATIVE_BALANCE", details: { asset_code: "PETR4", balance: -4 } });
    });
  });

  describe("delete_transaction", () => {
    it("deletes after validating the remaining timeline", async () => {
      const second_buy = build_transaction({ id: "buy_2", asset_id: "petr", quantity: 5 });
      prisma_mock.transaction.findFirst.mockResolvedValue(second_buy);
      prisma_mock.asset.findUniqueOrThrow.mockResolvedValue(petr);
      prisma_mock.transaction.findMany.mockResolvedValue([buy, second_buy]);

      await expect(delete_transaction("user_1", "portfolio_1", "buy_2")).resolves.toBeUndefined();

      expect(prisma_mock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma_mock.transaction.delete).toHaveBeenCalledWith({ where: { id: "buy_2" } });
    });

    it("rejects deleting a buy needed by later sells", async () => {
      const sell = build_transaction({
        id: "sell_1",
        asset_id: "petr",
        type: "SELL",
        quantity: 10,
        trade_date: new Date("2026-05-01T00:00:00.000Z"),
      });
      prisma_mock.transaction.findFirst.mockResolvedValue(buy);
      prisma_mock.asset.findUniqueOrThrow.mockResolvedValue(petr);
      prisma_mock.transaction.findMany.mockResolvedValue([buy, sell]);

      await expect(delete_transaction("user_1", "portfolio_1", "buy_1")).rejects.toMatchObject({
        code: "NEGATIVE_BALANCE",
      });
      expect(prisma_mock.transaction.delete).not.toHaveBeenCalled();
    });

    it("throws 404 for unknown transactions", async () => {
      prisma_mock.transaction.findFirst.mockResolvedValue(null);
      await expect(delete_transaction("user_1", "portfolio_1", "ghost")).rejects.toMatchObject({ status: 404 });
    });
  });
});
