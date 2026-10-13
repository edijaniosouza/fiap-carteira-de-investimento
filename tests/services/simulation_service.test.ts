import { describe, expect, it, vi } from "vitest";
import { build_asset } from "../support/factories";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/services/catalog_service", async (import_original) => ({
  ...(await import_original<typeof import("@/services/catalog_service")>()),
  get_investable_asset: vi.fn(),
}));
vi.mock("@/services/market/market_data_service", () => ({
  get_index_rates: vi.fn(),
  get_quote: vi.fn(),
}));

import { get_investable_asset } from "@/services/catalog_service";
import { get_index_rates, get_quote } from "@/services/market/market_data_service";
import { run_simulation } from "@/services/simulation_service";
import type { FixedIncomeSimulationDto, VariableIncomeSimulationDto } from "@/types/api";

const updated_at = new Date("2026-10-13T10:00:00.000Z");

describe("simulation_service.run_simulation", () => {
  describe("fixed income", () => {
    it("projects compound monthly growth and regressive income tax", async () => {
      const cdb = build_asset({ id: "cdb", code: "CDB_CDI", type: "CDB", indexer: "CDI", rate: 100, source: "SEED" });
      vi.mocked(get_investable_asset).mockResolvedValue(cdb);
      vi.mocked(get_index_rates).mockResolvedValue({ CDI: 12 });

      const result = (await run_simulation({ asset_id: "cdb", amount: 1000, months: 12 })) as FixedIncomeSimulationDto;

      expect(get_investable_asset).toHaveBeenCalledWith("cdb");
      expect(result.kind).toBe("FIXED_INCOME");
      expect(result.annual_rate).toBeCloseTo(0.12);
      expect(result.reference_index).toEqual({ code: "CDI", annual_rate: 12 });
      expect(result.monthly_series).toHaveLength(13);
      expect(result.monthly_series[0]).toEqual({ month: 0, value: 1000 });
      expect(result.gross_value).toBe(1120);
      expect(result.earnings).toBe(120);
      // 12 months * 30 days = 360 days → 20%.
      expect(result.income_tax_rate).toBe(0.2);
      expect(result.income_tax).toBe(24);
      expect(result.net_value).toBe(1096);
      expect(result.asset).toMatchObject({ id: "cdb", code: "CDB_CDI" });
      expect(result).toMatchObject({ amount: 1000, months: 12 });
    });

    it("has no reference index for prefixed assets", async () => {
      const pre = build_asset({ id: "pre", type: "CDB", indexer: "PRE", rate: 12, source: "SEED" });
      vi.mocked(get_investable_asset).mockResolvedValue(pre);
      vi.mocked(get_index_rates).mockResolvedValue({ CDI: 14 });

      const result = (await run_simulation({ asset_id: "pre", amount: 1000, months: 25 })) as FixedIncomeSimulationDto;

      expect(result.reference_index).toBeNull();
      expect(result.income_tax_rate).toBe(0.15);
    });

    it("does not tax losses (negative real rate)", async () => {
      const pre = build_asset({ id: "pre", type: "CDB", indexer: "PRE", rate: -5, source: "SEED" });
      vi.mocked(get_investable_asset).mockResolvedValue(pre);
      vi.mocked(get_index_rates).mockResolvedValue({});

      const result = (await run_simulation({ asset_id: "pre", amount: 1000, months: 12 })) as FixedIncomeSimulationDto;

      expect(result.earnings).toBeLessThan(0);
      expect(result.income_tax).toBe(0);
      expect(result.net_value).toBe(result.gross_value);
    });

    it("fails with QUOTE_UNAVAILABLE when the index rate is missing", async () => {
      const ipca = build_asset({ id: "ipca", type: "TREASURY", indexer: "IPCA", rate: 6, source: "SEED" });
      vi.mocked(get_investable_asset).mockResolvedValue(ipca);
      vi.mocked(get_index_rates).mockResolvedValue({});

      await expect(run_simulation({ asset_id: "ipca", amount: 1000, months: 12 })).rejects.toMatchObject({
        status: 422,
        code: "QUOTE_UNAVAILABLE",
      });
    });
  });

  describe("variable income", () => {
    const stock = build_asset({ id: "stock", code: "PETR4", type: "STOCK" });

    it("computes buyable shares, leftover and three scenarios", async () => {
      vi.mocked(get_investable_asset).mockResolvedValue(stock);
      vi.mocked(get_quote).mockResolvedValue({
        asset_id: "stock",
        value: 30,
        source: "BRAPI",
        updated_at,
        is_stale: false,
      });

      const result = (await run_simulation({ asset_id: "stock", amount: 1000, months: 12 })) as VariableIncomeSimulationDto;

      expect(get_quote).toHaveBeenCalledWith(stock);
      expect(result).toMatchObject({
        kind: "VARIABLE_INCOME",
        amount: 1000,
        months: 12,
        current_price: 30,
        price_status: "MARKET",
        share_quantity: 33,
        invested_amount: 990,
        leftover: 10,
      });
      expect(result.scenarios).toEqual([
        { name: "PESSIMISTIC", annual_return: -0.1, final_value: 901, result: -99 },
        { name: "BASE", annual_return: 0.08, final_value: 1079.2, result: 79.2 },
        { name: "OPTIMISTIC", annual_return: 0.2, final_value: 1198, result: 198 },
      ]);
      expect(result.monthly_series).toHaveLength(13);
      expect(result.monthly_series[0]).toEqual({ month: 0, pessimistic: 1000, base: 1000, optimistic: 1000 });
      expect(result.monthly_series[12]).toEqual({ month: 12, pessimistic: 901, base: 1079.2, optimistic: 1198 });
    });

    it("flags stale quotes", async () => {
      vi.mocked(get_investable_asset).mockResolvedValue(stock);
      vi.mocked(get_quote).mockResolvedValue({
        asset_id: "stock",
        value: 30,
        source: "BRAPI",
        updated_at,
        is_stale: true,
      });

      const result = (await run_simulation({ asset_id: "stock", amount: 100, months: 1 })) as VariableIncomeSimulationDto;

      expect(result.price_status).toBe("STALE");
    });

    it.each([
      ["missing", null],
      ["zero", { asset_id: "stock", value: 0, source: "BRAPI" as const, updated_at, is_stale: false }],
    ])("fails when the quote is %s", async (_label, quote) => {
      vi.mocked(get_investable_asset).mockResolvedValue(stock);
      vi.mocked(get_quote).mockResolvedValue(quote);

      await expect(run_simulation({ asset_id: "stock", amount: 1000, months: 12 })).rejects.toMatchObject({
        status: 422,
        code: "QUOTE_UNAVAILABLE",
        message: "Cotação de PETR4 indisponível no momento",
      });
    });
  });
});
