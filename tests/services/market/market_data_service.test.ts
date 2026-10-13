import { beforeEach, describe, expect, it, vi } from "vitest";
import { build_asset, build_quote } from "../../support/factories";
import type { PrismaMock } from "../../support/prisma_mock";

vi.mock("@/lib/prisma", async () => {
  const { create_prisma_mock } = await import("../../support/prisma_mock");
  return { prisma: create_prisma_mock() };
});
vi.mock("@/services/market/brapi_client", () => ({ fetch_brapi_price: vi.fn() }));
vi.mock("@/services/market/bcb_client", async (import_original) => ({
  ...(await import_original<typeof import("@/services/market/bcb_client")>()),
  fetch_bcb_index_rate: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { fetch_bcb_index_rate } from "@/services/market/bcb_client";
import { fetch_brapi_price } from "@/services/market/brapi_client";
import {
  get_index_rates,
  get_quote,
  get_quotes,
  QUOTE_CACHE_TTL_MS,
  to_quote_dto,
} from "@/services/market/market_data_service";

const prisma_mock = prisma as unknown as PrismaMock;

const MINUTE = 60 * 1000;

function minutes_ago(minutes: number): Date {
  return new Date(Date.now() - minutes * MINUTE);
}

describe("market_data_service", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    prisma_mock.quote.upsert.mockImplementation(async ({ create }) =>
      build_quote({ asset_id: create.asset_id, value: create.value, source: create.source, updated_at: create.updated_at }),
    );
  });

  it("uses a 30 minute cache TTL", () => {
    expect(QUOTE_CACHE_TTL_MS).toBe(30 * MINUTE);
  });

  it("to_quote_dto serializes the update date", () => {
    const updated_at = new Date("2026-10-13T12:00:00.000Z");
    expect(
      to_quote_dto({ asset_id: "a", value: 10, source: "BRAPI", updated_at, is_stale: false }),
    ).toEqual({ asset_id: "a", value: 10, source: "BRAPI", updated_at: "2026-10-13T12:00:00.000Z", is_stale: false });
  });

  describe("get_quote", () => {
    const stock = build_asset({ id: "stock_1", code: "PETR4", type: "STOCK" });

    it("returns a fresh cached quote without calling the source", async () => {
      const updated_at = minutes_ago(5);
      prisma_mock.quote.findUnique.mockResolvedValue(build_quote({ asset_id: "stock_1", value: 30, updated_at }));

      await expect(get_quote(stock)).resolves.toEqual({
        asset_id: "stock_1",
        value: 30,
        source: "BRAPI",
        updated_at,
        is_stale: false,
      });
      expect(prisma_mock.quote.findUnique).toHaveBeenCalledWith({ where: { asset_id: "stock_1" } });
      expect(fetch_brapi_price).not.toHaveBeenCalled();
    });

    it("refreshes variable income from brapi when the cache is expired", async () => {
      prisma_mock.quote.findUnique.mockResolvedValue(build_quote({ asset_id: "stock_1", updated_at: minutes_ago(31) }));
      vi.mocked(fetch_brapi_price).mockResolvedValue(36.5);

      const quote = await get_quote(stock);

      expect(fetch_brapi_price).toHaveBeenCalledWith("PETR4");
      expect(prisma_mock.quote.upsert).toHaveBeenCalledWith({
        where: { asset_id: "stock_1" },
        create: { asset_id: "stock_1", value: 36.5, source: "BRAPI", updated_at: expect.any(Date) },
        update: { value: 36.5, source: "BRAPI", updated_at: expect.any(Date) },
      });
      expect(quote).toMatchObject({ asset_id: "stock_1", value: 36.5, source: "BRAPI", is_stale: false });
      expect(console.info).toHaveBeenCalledWith("[market_data] PETR4 refreshed from BRAPI");
    });

    it("refreshes when there is no cached quote", async () => {
      prisma_mock.quote.findUnique.mockResolvedValue(null);
      vi.mocked(fetch_brapi_price).mockResolvedValue(10);
      await expect(get_quote(stock)).resolves.toMatchObject({ value: 10 });
    });

    it("refreshes BCB indexes", async () => {
      const cdi = build_asset({ id: "cdi", code: "CDI", type: "INDEX", source: "BCB" });
      prisma_mock.quote.findUnique.mockResolvedValue(null);
      vi.mocked(fetch_bcb_index_rate).mockResolvedValue(14.9);

      await expect(get_quote(cdi)).resolves.toMatchObject({ asset_id: "cdi", value: 14.9, source: "BCB" });
      expect(fetch_bcb_index_rate).toHaveBeenCalledWith("CDI");
    });

    it("returns the cached seed price for assets without a remote source", async () => {
      const treasury = build_asset({ id: "tesouro", code: "TESOURO_IPCA_2035", type: "TREASURY", source: "SEED" });
      const updated_at = minutes_ago(60 * 24);
      prisma_mock.quote.findUnique.mockResolvedValue(
        build_quote({ asset_id: "tesouro", value: 3000, source: "SEED", updated_at }),
      );

      await expect(get_quote(treasury)).resolves.toEqual({
        asset_id: "tesouro",
        value: 3000,
        source: "SEED",
        updated_at,
        is_stale: false,
      });
      expect(prisma_mock.quote.upsert).not.toHaveBeenCalled();
    });

    it("returns null for assets without source nor cache (CDB)", async () => {
      const cdb = build_asset({ id: "cdb", code: "CDB_110", type: "CDB", source: "SEED" });
      prisma_mock.quote.findUnique.mockResolvedValue(null);
      await expect(get_quote(cdb)).resolves.toBeNull();
    });

    it("returns null for unknown index codes without cache", async () => {
      const index = build_asset({ id: "igpm", code: "IGPM", type: "INDEX" });
      prisma_mock.quote.findUnique.mockResolvedValue(null);
      await expect(get_quote(index)).resolves.toBeNull();
      expect(fetch_bcb_index_rate).not.toHaveBeenCalled();
    });

    it("falls back to the stale cached quote when the source fails", async () => {
      prisma_mock.quote.findUnique.mockResolvedValue(
        build_quote({ asset_id: "stock_1", value: 29, updated_at: minutes_ago(90) }),
      );
      vi.mocked(fetch_brapi_price).mockRejectedValue(new Error("timeout"));

      await expect(get_quote(stock)).resolves.toMatchObject({ value: 29, is_stale: true });
      expect(console.warn).toHaveBeenCalledWith("[market_data] failed to refresh PETR4: timeout");
    });

    it("returns null when the source fails and there is no cache", async () => {
      prisma_mock.quote.findUnique.mockResolvedValue(null);
      vi.mocked(fetch_brapi_price).mockRejectedValue("network down");

      await expect(get_quote(stock)).resolves.toBeNull();
      expect(console.warn).toHaveBeenCalledWith("[market_data] failed to refresh PETR4: network down");
    });

    it("deduplicates concurrent refreshes of the same asset", async () => {
      prisma_mock.quote.findUnique.mockResolvedValue(null);
      let resolve_price: (value: number) => void = () => {};
      vi.mocked(fetch_brapi_price).mockReturnValue(new Promise((resolve) => (resolve_price = resolve)));

      const first = get_quote(stock);
      const second = get_quote(stock);
      await vi.waitFor(() => expect(fetch_brapi_price).toHaveBeenCalled());
      resolve_price(40);

      await expect(Promise.all([first, second])).resolves.toEqual([
        expect.objectContaining({ value: 40 }),
        expect.objectContaining({ value: 40 }),
      ]);
      expect(fetch_brapi_price).toHaveBeenCalledTimes(1);
    });
  });

  describe("get_quotes", () => {
    it("returns a map with available quotes only, fetching in chunks", async () => {
      const assets = Array.from({ length: 6 }, (_, index) =>
        build_asset({ id: `a${index}`, code: `A${index}`, type: index === 5 ? "CDB" : "STOCK" }),
      );
      prisma_mock.quote.findUnique.mockResolvedValue(null);
      vi.mocked(fetch_brapi_price).mockImplementation(async (ticker) => Number(ticker.slice(1)) + 1);

      const quotes = await get_quotes(assets);

      expect([...quotes.keys()]).toEqual(["a0", "a1", "a2", "a3", "a4"]);
      expect(quotes.get("a2")?.value).toBe(3);
      expect(fetch_brapi_price).toHaveBeenCalledTimes(5);
    });

    it("returns an empty map for no assets", async () => {
      await expect(get_quotes([])).resolves.toEqual(new Map());
    });
  });

  describe("get_index_rates", () => {
    it("reads CDI, SELIC and IPCA through the quote cache", async () => {
      prisma_mock.asset.findMany.mockResolvedValue([
        build_asset({ id: "cdi", code: "CDI", type: "INDEX" }),
        build_asset({ id: "selic", code: "SELIC", type: "INDEX" }),
        build_asset({ id: "ipca", code: "IPCA", type: "INDEX" }),
      ]);
      prisma_mock.quote.findUnique.mockImplementation(async ({ where }) =>
        where.asset_id === "ipca" ? null : build_quote({ asset_id: where.asset_id, value: where.asset_id === "cdi" ? 14.9 : 15, updated_at: minutes_ago(1) }),
      );
      vi.mocked(fetch_bcb_index_rate).mockRejectedValue(new Error("down"));

      await expect(get_index_rates()).resolves.toEqual({ CDI: 14.9, SELIC: 15 });
      expect(prisma_mock.asset.findMany).toHaveBeenCalledWith({
        where: { type: "INDEX", code: { in: ["CDI", "SELIC", "IPCA"] } },
      });
    });

    it("ignores quotes of non BCB codes", async () => {
      prisma_mock.asset.findMany.mockResolvedValue([build_asset({ id: "x", code: "OTHER", type: "INDEX" })]);
      prisma_mock.quote.findUnique.mockResolvedValue(build_quote({ asset_id: "x", value: 1, updated_at: minutes_ago(1) }));

      await expect(get_index_rates()).resolves.toEqual({});
    });
  });
});
