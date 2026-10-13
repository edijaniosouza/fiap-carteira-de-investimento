import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { build_asset, build_portfolio, build_transaction } from "../support/factories";
import type { PrismaMock } from "../support/prisma_mock";

vi.mock("@/lib/prisma", async () => {
  const { create_prisma_mock } = await import("../support/prisma_mock");
  return { prisma: create_prisma_mock() };
});
vi.mock("@/services/market/market_data_service", () => ({
  get_quotes: vi.fn(),
  get_index_rates: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { get_index_rates, get_quotes, type QuoteResult } from "@/services/market/market_data_service";
import {
  create_portfolio,
  delete_portfolio,
  get_owned_portfolio,
  get_portfolio_summary,
  get_positions,
  list_portfolios,
  rename_portfolio,
} from "@/services/portfolio_service";

const prisma_mock = prisma as unknown as PrismaMock;

const portfolio = build_portfolio();
const NOW = new Date("2026-10-13T00:00:00.000Z");

function quote(asset_id: string, value: number, is_stale = false): QuoteResult {
  return { asset_id, value, source: "BRAPI", updated_at: new Date("2026-10-13T10:00:00.000Z"), is_stale };
}

describe("portfolio_service", () => {
  describe("get_owned_portfolio", () => {
    it("returns the portfolio owned by the user", async () => {
      prisma_mock.portfolio.findFirst.mockResolvedValue(portfolio);

      await expect(get_owned_portfolio("user_1", "portfolio_1")).resolves.toBe(portfolio);
      expect(prisma_mock.portfolio.findFirst).toHaveBeenCalledWith({
        where: { id: "portfolio_1", user_id: "user_1" },
      });
    });

    it("answers 404 for foreign or missing portfolios", async () => {
      prisma_mock.portfolio.findFirst.mockResolvedValue(null);
      await expect(get_owned_portfolio("user_2", "portfolio_1")).rejects.toMatchObject({
        status: 404,
        message: "Carteira não encontrada",
      });
    });
  });

  describe("list_portfolios", () => {
    it("lists portfolios with transaction counts and plan info", async () => {
      prisma_mock.portfolio.findMany.mockResolvedValue([{ ...portfolio, _count: { transactions: 3 } }]);

      await expect(list_portfolios("user_1")).resolves.toEqual({
        items: [
          { id: "portfolio_1", name: "Principal", created_at: "2026-02-01T00:00:00.000Z", transaction_count: 3 },
        ],
        plan: { max_portfolios: 1, can_create: false },
      });
      expect(prisma_mock.portfolio.findMany).toHaveBeenCalledWith({
        where: { user_id: "user_1" },
        include: { _count: { select: { transactions: true } } },
        orderBy: { created_at: "asc" },
      });
    });

    it("allows creation when the user has no portfolios", async () => {
      prisma_mock.portfolio.findMany.mockResolvedValue([]);
      await expect(list_portfolios("user_1")).resolves.toEqual({
        items: [],
        plan: { max_portfolios: 1, can_create: true },
      });
    });
  });

  describe("create_portfolio", () => {
    it("creates a portfolio within the plan limit", async () => {
      prisma_mock.portfolio.count.mockResolvedValue(0);
      prisma_mock.portfolio.create.mockResolvedValue(portfolio);

      await expect(create_portfolio("user_1", { name: "Principal" })).resolves.toMatchObject({
        id: "portfolio_1",
        transaction_count: 0,
      });
      expect(prisma_mock.portfolio.create).toHaveBeenCalledWith({ data: { user_id: "user_1", name: "Principal" } });
    });

    it("rejects creation above the free plan limit", async () => {
      prisma_mock.portfolio.count.mockResolvedValue(1);

      await expect(create_portfolio("user_1", { name: "Outra" })).rejects.toMatchObject({
        status: 403,
        code: "PLAN_LIMIT_REACHED",
        message: "O plano gratuito permite até 1 carteira(s)",
      });
      expect(prisma_mock.portfolio.create).not.toHaveBeenCalled();
    });
  });

  describe("rename_portfolio", () => {
    it("renames an owned portfolio", async () => {
      prisma_mock.portfolio.findFirst.mockResolvedValue(portfolio);
      prisma_mock.portfolio.update.mockResolvedValue({ ...portfolio, name: "Nova", _count: { transactions: 5 } });

      await expect(rename_portfolio("user_1", "portfolio_1", { name: "Nova" })).resolves.toMatchObject({
        name: "Nova",
        transaction_count: 5,
      });
      expect(prisma_mock.portfolio.update).toHaveBeenCalledWith({
        where: { id: "portfolio_1" },
        data: { name: "Nova" },
        include: { _count: { select: { transactions: true } } },
      });
    });

    it("does not rename foreign portfolios", async () => {
      prisma_mock.portfolio.findFirst.mockResolvedValue(null);
      await expect(rename_portfolio("user_2", "portfolio_1", { name: "X" })).rejects.toMatchObject({ status: 404 });
      expect(prisma_mock.portfolio.update).not.toHaveBeenCalled();
    });
  });

  describe("delete_portfolio", () => {
    it("deletes an owned portfolio", async () => {
      prisma_mock.portfolio.findFirst.mockResolvedValue(portfolio);
      await delete_portfolio("user_1", "portfolio_1");
      expect(prisma_mock.portfolio.delete).toHaveBeenCalledWith({ where: { id: "portfolio_1" } });
    });

    it("does not delete foreign portfolios", async () => {
      prisma_mock.portfolio.findFirst.mockResolvedValue(null);
      await expect(delete_portfolio("user_2", "portfolio_1")).rejects.toMatchObject({ status: 404 });
      expect(prisma_mock.portfolio.delete).not.toHaveBeenCalled();
    });
  });

  describe("positions", () => {
    const stock = build_asset({ id: "stock", code: "PETR4", type: "STOCK" });
    const fii = build_asset({ id: "fii", code: "HGLG11", type: "FII" });
    const cdb = build_asset({ id: "cdb", code: "CDB_PRE", type: "CDB", indexer: "PRE", rate: 10, source: "SEED" });
    const cdb_cdi = build_asset({ id: "cdb_cdi", code: "CDB_CDI", type: "CDB", indexer: "CDI", rate: 100, source: "SEED" });
    const closed = build_asset({ id: "closed", code: "VALE3", type: "STOCK" });

    function with_asset(asset: ReturnType<typeof build_asset>, overrides: Parameters<typeof build_transaction>[0]) {
      return { ...build_transaction({ asset_id: asset.id, ...overrides }), asset };
    }

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      prisma_mock.portfolio.findFirst.mockResolvedValue(portfolio);
      vi.mocked(get_quotes).mockResolvedValue(new Map());
      vi.mocked(get_index_rates).mockResolvedValue({});
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("get_positions checks ownership", async () => {
      prisma_mock.portfolio.findFirst.mockResolvedValue(null);
      await expect(get_positions("user_2", "portfolio_1")).rejects.toMatchObject({ status: 404 });
      expect(prisma_mock.transaction.findMany).not.toHaveBeenCalled();
    });

    it("prices variable income with market and stale quotes", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([
        with_asset(stock, { id: "t1", quantity: 10, unit_price: 30 }),
        with_asset(fii, { id: "t2", quantity: 2, unit_price: 100 }),
      ]);
      vi.mocked(get_quotes).mockResolvedValue(
        new Map([
          ["stock", quote("stock", 35)],
          ["fii", quote("fii", 90, true)],
        ]),
      );

      const positions = await get_positions("user_1", "portfolio_1");

      expect(prisma_mock.transaction.findMany).toHaveBeenCalledWith({
        where: { portfolio_id: "portfolio_1" },
        include: { asset: true },
      });
      expect(get_index_rates).not.toHaveBeenCalled();
      expect(positions).toEqual([
        {
          asset: { id: "stock", code: "PETR4", name: "Petrobras PN", type: "STOCK", indexer: null, rate: null },
          quantity: 10,
          average_price: 30,
          total_cost: 300,
          current_price: 35,
          current_value: 350,
          unrealized_result: 50,
          realized_result: 0,
          result_percent: 50 / 300,
          price_status: "MARKET",
          price_updated_at: "2026-10-13T10:00:00.000Z",
        },
        expect.objectContaining({
          asset: expect.objectContaining({ id: "fii" }),
          current_value: 180,
          unrealized_result: -20,
          price_status: "STALE",
        }),
      ]);
    });

    it("estimates fixed income without quote using the indexer rate", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([
        with_asset(cdb, {
          id: "t1",
          quantity: 1,
          unit_price: 1000,
          trade_date: new Date("2025-10-13T00:00:00.000Z"),
        }),
      ]);

      const [position] = await get_positions("user_1", "portfolio_1");

      expect(get_index_rates).toHaveBeenCalledTimes(1);
      expect(position.price_status).toBe("ESTIMATED");
      expect(position.price_updated_at).toBeNull();
      expect(position.current_price).toBeCloseTo(1100, 4);
      expect(position.current_value).toBe(1100);
      expect(position.unrealized_result).toBe(100);
    });

    it("marks fixed income as unavailable when the index rate is missing", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([
        with_asset(cdb_cdi, { id: "t1", quantity: 2, unit_price: 500 }),
      ]);

      const [position] = await get_positions("user_1", "portfolio_1");

      expect(position).toMatchObject({
        price_status: "UNAVAILABLE",
        current_price: null,
        current_value: 1000,
        unrealized_result: 0,
      });
    });

    it("marks variable income without quote as unavailable", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([with_asset(stock, { id: "t1", quantity: 1, unit_price: 10 })]);

      const [position] = await get_positions("user_1", "portfolio_1");

      expect(position).toMatchObject({ price_status: "UNAVAILABLE", current_price: null, current_value: 10 });
    });

    it("keeps closed positions without pricing them and sorts by value then code", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([
        with_asset(closed, { id: "t1", quantity: 5, unit_price: 10 }),
        with_asset(closed, {
          id: "t2",
          type: "SELL",
          quantity: 5,
          unit_price: 12,
          trade_date: new Date("2026-04-01T00:00:00.000Z"),
        }),
        with_asset(stock, { id: "t3", quantity: 1, unit_price: 10 }),
      ]);
      vi.mocked(get_quotes).mockResolvedValue(new Map([["stock", quote("stock", 10)]]));

      const positions = await get_positions("user_1", "portfolio_1");

      expect(get_quotes).toHaveBeenCalledWith([stock]);
      expect(positions.map((position) => position.asset.code)).toEqual(["PETR4", "VALE3"]);
      expect(positions[1]).toMatchObject({
        quantity: 0,
        current_price: null,
        current_value: 0,
        realized_result: 10,
        result_percent: 0,
        price_status: "UNAVAILABLE",
      });
    });

    it("sorts positions with the same value by code", async () => {
      prisma_mock.transaction.findMany.mockResolvedValue([
        with_asset(stock, { id: "t1", quantity: 1, unit_price: 10 }),
        with_asset(fii, { id: "t2", quantity: 1, unit_price: 10 }),
      ]);

      const positions = await get_positions("user_1", "portfolio_1");

      expect(positions.map((position) => position.asset.code)).toEqual(["HGLG11", "PETR4"]);
    });

    it("get_portfolio_summary consolidates totals and allocation", async () => {
      prisma_mock.portfolio.findUniqueOrThrow.mockResolvedValue({ ...portfolio, _count: { transactions: 4 } });
      prisma_mock.transaction.findMany.mockResolvedValue([
        with_asset(stock, { id: "t1", quantity: 10, unit_price: 30 }),
        with_asset(fii, { id: "t2", quantity: 2, unit_price: 100 }),
        with_asset(closed, { id: "t3", quantity: 5, unit_price: 10 }),
        with_asset(closed, {
          id: "t4",
          type: "SELL",
          quantity: 5,
          unit_price: 14,
          trade_date: new Date("2026-04-01T00:00:00.000Z"),
        }),
      ]);
      vi.mocked(get_quotes).mockResolvedValue(
        new Map([
          ["stock", quote("stock", 40)],
          ["fii", quote("fii", 50)],
        ]),
      );

      const summary = await get_portfolio_summary("user_1", "portfolio_1");

      expect(prisma_mock.portfolio.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "portfolio_1" },
        include: { _count: { select: { transactions: true } } },
      });
      expect(summary.portfolio).toEqual({
        id: "portfolio_1",
        name: "Principal",
        created_at: "2026-02-01T00:00:00.000Z",
        transaction_count: 4,
      });
      expect(summary.totals).toEqual({
        invested_total: 500,
        current_total: 500,
        unrealized_result: 0,
        realized_result: 20,
        result_total: 20,
        result_percent: 0,
      });
      expect(summary.allocation_by_type).toEqual([
        { type: "STOCK", value: 400, percent: 0.8 },
        { type: "FII", value: 100, percent: 0.2 },
      ]);
      expect(summary.positions).toHaveLength(3);
    });

    it("get_portfolio_summary handles an empty portfolio", async () => {
      prisma_mock.portfolio.findUniqueOrThrow.mockResolvedValue({ ...portfolio, _count: { transactions: 0 } });
      prisma_mock.transaction.findMany.mockResolvedValue([]);

      const summary = await get_portfolio_summary("user_1", "portfolio_1");

      expect(summary.totals).toEqual({
        invested_total: 0,
        current_total: 0,
        unrealized_result: 0,
        realized_result: 0,
        result_total: 0,
        result_percent: 0,
      });
      expect(summary.allocation_by_type).toEqual([]);
      expect(summary.positions).toEqual([]);
    });

    it("get_portfolio_summary computes allocation percent zero when the current total is zero", async () => {
      prisma_mock.portfolio.findUniqueOrThrow.mockResolvedValue({ ...portfolio, _count: { transactions: 1 } });
      prisma_mock.transaction.findMany.mockResolvedValue([with_asset(stock, { id: "t1", quantity: 1, unit_price: 10 })]);
      vi.mocked(get_quotes).mockResolvedValue(new Map([["stock", quote("stock", 0)]]));

      const summary = await get_portfolio_summary("user_1", "portfolio_1");

      expect(summary.allocation_by_type).toEqual([{ type: "STOCK", value: 0, percent: 0 }]);
      expect(summary.totals.result_percent).toBe(-1);
    });
  });
});
