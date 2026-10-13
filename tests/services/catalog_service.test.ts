import { describe, expect, it, vi } from "vitest";
import { build_asset, build_quote } from "../support/factories";
import type { PrismaMock } from "../support/prisma_mock";

vi.mock("@/lib/prisma", async () => {
  const { create_prisma_mock } = await import("../support/prisma_mock");
  return { prisma: create_prisma_mock() };
});

import { prisma } from "@/lib/prisma";
import {
  get_investable_asset,
  search_assets,
  to_asset_dto,
  to_asset_summary_dto,
} from "@/services/catalog_service";

const prisma_mock = prisma as unknown as PrismaMock;

describe("catalog_service", () => {
  describe("to_asset_summary_dto", () => {
    it("maps the asset and converts the decimal rate", () => {
      expect(to_asset_summary_dto(build_asset({ type: "CDB", indexer: "CDI", rate: 110 }))).toEqual({
        id: "asset_1",
        code: "PETR4",
        name: "Petrobras PN",
        type: "CDB",
        indexer: "CDI",
        rate: 110,
      });
    });

    it("keeps a null rate", () => {
      expect(to_asset_summary_dto(build_asset()).rate).toBeNull();
    });
  });

  describe("to_asset_dto", () => {
    it("includes source, maturity and the last quote", () => {
      const asset = build_asset({
        type: "TREASURY",
        source: "SEED",
        maturity_date: new Date("2035-05-15T00:00:00.000Z"),
      });
      const quote = build_quote({ value: 3100.5, updated_at: new Date("2026-10-13T12:00:00.000Z") });

      expect(to_asset_dto({ ...asset, quote })).toMatchObject({
        source: "SEED",
        maturity_date: "2035-05-15",
        last_price: 3100.5,
        last_price_updated_at: "2026-10-13T12:00:00.000Z",
      });
    });

    it("uses nulls when there is no maturity nor quote", () => {
      expect(to_asset_dto({ ...build_asset(), quote: null })).toMatchObject({
        maturity_date: null,
        last_price: null,
        last_price_updated_at: null,
      });
    });
  });

  describe("search_assets", () => {
    it("excludes indexes when no type filter is given and paginates", async () => {
      prisma_mock.asset.count.mockResolvedValue(45);
      prisma_mock.asset.findMany.mockResolvedValue([{ ...build_asset(), quote: null }]);

      const result = await search_assets({ type: [], q: "", page: 3, limit: 20 });

      const where = { type: { not: "INDEX" } };
      expect(prisma_mock.asset.count).toHaveBeenCalledWith({ where });
      expect(prisma_mock.asset.findMany).toHaveBeenCalledWith({
        where,
        include: { quote: true },
        orderBy: { code: "asc" },
        skip: 40,
        take: 20,
      });
      expect(result).toMatchObject({ page: 3, limit: 20, total: 45, total_pages: 3 });
      expect(result.items).toHaveLength(1);
    });

    it("filters by type and searches code or name case-insensitively", async () => {
      prisma_mock.asset.count.mockResolvedValue(0);
      prisma_mock.asset.findMany.mockResolvedValue([]);

      const result = await search_assets({ type: ["STOCK", "FII"], q: "petr", page: 1, limit: 10 });

      expect(prisma_mock.asset.count).toHaveBeenCalledWith({
        where: {
          type: { in: ["STOCK", "FII"] },
          OR: [
            { code: { contains: "petr", mode: "insensitive" } },
            { name: { contains: "petr", mode: "insensitive" } },
          ],
        },
      });
      expect(result).toEqual({ items: [], page: 1, limit: 10, total: 0, total_pages: 1 });
    });
  });

  describe("get_investable_asset", () => {
    it("returns tradable assets", async () => {
      const asset = build_asset();
      prisma_mock.asset.findUnique.mockResolvedValue(asset);

      await expect(get_investable_asset("asset_1")).resolves.toBe(asset);
      expect(prisma_mock.asset.findUnique).toHaveBeenCalledWith({ where: { id: "asset_1" } });
    });

    it("throws 404 for unknown assets", async () => {
      prisma_mock.asset.findUnique.mockResolvedValue(null);
      await expect(get_investable_asset("ghost")).rejects.toMatchObject({
        status: 404,
        message: "Ativo não encontrado",
      });
    });

    it("rejects reference indexes", async () => {
      prisma_mock.asset.findUnique.mockResolvedValue(build_asset({ type: "INDEX", code: "CDI" }));
      await expect(get_investable_asset("cdi")).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
    });
  });
});
