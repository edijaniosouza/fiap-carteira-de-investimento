import { beforeEach, describe, expect, it, vi } from "vitest";
import { build_asset } from "../../support/factories";
import { get_request, json_request, route_context, SESSION } from "../../support/route_helpers";

vi.mock("@/lib/auth/session", () => ({ require_session: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { asset: { findUnique: vi.fn() } } }));
vi.mock("@/services/catalog_service", () => ({ search_assets: vi.fn() }));
vi.mock("@/services/simulation_service", () => ({ run_simulation: vi.fn() }));
vi.mock("@/services/market/market_data_service", async (import_original) => ({
  ...(await import_original<typeof import("@/services/market/market_data_service")>()),
  get_quote: vi.fn(),
}));

import { GET as catalog_get } from "@/app/api/catalog/route";
import { GET as quote_get } from "@/app/api/quotes/[asset_id]/route";
import { POST as simulations_post } from "@/app/api/simulations/route";
import { require_session } from "@/lib/auth/session";
import { unauthorized_error } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { search_assets } from "@/services/catalog_service";
import { get_quote } from "@/services/market/market_data_service";
import { run_simulation } from "@/services/simulation_service";
import type { SimulationDto } from "@/types/api";

describe("market routes", () => {
  beforeEach(() => {
    vi.mocked(require_session).mockResolvedValue(SESSION);
  });

  describe("GET /api/catalog", () => {
    it("parses the query string and searches assets", async () => {
      const page = { items: [], page: 2, limit: 10, total: 0, total_pages: 1 };
      vi.mocked(search_assets).mockResolvedValue(page);

      const response = await catalog_get(
        get_request("/api/catalog?type=STOCK,FII&q=petr&page=2&limit=10"),
        route_context({}),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(page);
      expect(search_assets).toHaveBeenCalledWith({ type: ["STOCK", "FII"], q: "petr", page: 2, limit: 10 });
    });

    it("rejects invalid filters", async () => {
      const response = await catalog_get(get_request("/api/catalog?type=CRYPTO"), route_context({}));
      expect(response.status).toBe(400);
      expect(search_assets).not.toHaveBeenCalled();
    });

    it("requires a session", async () => {
      vi.mocked(require_session).mockRejectedValue(unauthorized_error());
      const response = await catalog_get(get_request("/api/catalog"), route_context({}));
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/quotes/[asset_id]", () => {
    const find_unique = vi.mocked(prisma.asset.findUnique);

    it("returns the current quote", async () => {
      const asset = build_asset();
      find_unique.mockResolvedValue(asset);
      vi.mocked(get_quote).mockResolvedValue({
        asset_id: "asset_1",
        value: 35,
        source: "BRAPI",
        updated_at: new Date("2026-10-13T12:00:00.000Z"),
        is_stale: false,
      });

      const response = await quote_get(get_request("/api/quotes/asset_1"), route_context({ asset_id: "asset_1" }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        asset_id: "asset_1",
        value: 35,
        source: "BRAPI",
        updated_at: "2026-10-13T12:00:00.000Z",
        is_stale: false,
      });
      expect(find_unique).toHaveBeenCalledWith({ where: { id: "asset_1" } });
      expect(get_quote).toHaveBeenCalledWith(asset);
    });

    it("answers 404 for unknown assets", async () => {
      find_unique.mockResolvedValue(null);
      const response = await quote_get(get_request("/api/quotes/ghost"), route_context({ asset_id: "ghost" }));
      expect(response.status).toBe(404);
      expect((await response.json()).error.message).toBe("Ativo não encontrado");
    });

    it("answers 422 when there is no quote", async () => {
      find_unique.mockResolvedValue(build_asset({ code: "CDB_X" }));
      vi.mocked(get_quote).mockResolvedValue(null);

      const response = await quote_get(get_request("/api/quotes/asset_1"), route_context({ asset_id: "asset_1" }));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        error: { code: "QUOTE_UNAVAILABLE", message: "Cotação de CDB_X indisponível no momento" },
      });
    });
  });

  describe("POST /api/simulations", () => {
    it("runs the simulation with coerced input", async () => {
      const result = { kind: "FIXED_INCOME" } as SimulationDto;
      vi.mocked(run_simulation).mockResolvedValue(result);

      const response = await simulations_post(
        json_request("/api/simulations", "POST", { asset_id: "asset_1", amount: "1000", months: "12" }),
        route_context({}),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(result);
      expect(run_simulation).toHaveBeenCalledWith({ asset_id: "asset_1", amount: 1000, months: 12 });
    });

    it("validates the input", async () => {
      const response = await simulations_post(
        json_request("/api/simulations", "POST", { asset_id: "", amount: 0, months: 0 }),
        route_context({}),
      );
      expect(response.status).toBe(400);
      expect(run_simulation).not.toHaveBeenCalled();
    });
  });
});
