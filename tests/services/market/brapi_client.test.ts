import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetch_brapi_list_page, fetch_brapi_price } from "@/services/market/brapi_client";

const fetch_mock = vi.fn();

function json_response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function requested_url(): URL {
  return new URL(fetch_mock.mock.calls[0][0]);
}

describe("brapi_client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetch_mock);
    vi.stubEnv("BRAPI_TOKEN", "");
  });

  describe("fetch_brapi_price", () => {
    it("returns the regular market price", async () => {
      fetch_mock.mockResolvedValue(json_response({ results: [{ symbol: "PETR4", regularMarketPrice: 35.2 }] }));

      await expect(fetch_brapi_price("PETR4")).resolves.toBe(35.2);
      expect(requested_url().toString()).toBe("https://brapi.dev/api/quote/PETR4");
      expect(fetch_mock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    });

    it("encodes the ticker and appends the token when configured", async () => {
      vi.stubEnv("BRAPI_TOKEN", "secret");
      fetch_mock.mockResolvedValue(json_response({ results: [{ symbol: "A B", regularMarketPrice: 1 }] }));

      await fetch_brapi_price("A B");

      const url = requested_url();
      expect(url.pathname).toBe("/api/quote/A%20B");
      expect(url.searchParams.get("token")).toBe("secret");
    });

    it("throws when there is no price", async () => {
      fetch_mock.mockResolvedValue(json_response({ results: [{ symbol: "PETR4", regularMarketPrice: null }] }));
      await expect(fetch_brapi_price("PETR4")).rejects.toThrow("brapi returned no price for PETR4");
    });

    it("throws when the results are empty", async () => {
      fetch_mock.mockResolvedValue(json_response({ results: [] }));
      await expect(fetch_brapi_price("XXXX3")).rejects.toThrow("brapi returned no price for XXXX3");
    });

    it("throws on HTTP errors", async () => {
      fetch_mock.mockResolvedValue(json_response({}, 404));
      await expect(fetch_brapi_price("PETR4")).rejects.toThrow("brapi request failed with status 404");
    });

    it("throws on invalid payloads", async () => {
      fetch_mock.mockResolvedValue(json_response({ unexpected: true }));
      await expect(fetch_brapi_price("PETR4")).rejects.toThrow();
    });
  });

  describe("fetch_brapi_list_page", () => {
    it("maps listed assets with defaults", async () => {
      fetch_mock.mockResolvedValue(
        json_response({
          stocks: [
            { stock: "PETR4", name: "Petrobras", close: 35, type: "stock", sector: "Energy" },
            { stock: "XPML11" },
          ],
          hasNextPage: true,
        }),
      );

      await expect(fetch_brapi_list_page(2, 100)).resolves.toEqual({
        assets: [
          { ticker: "PETR4", name: "Petrobras", brapi_type: "stock", sector: "Energy", close_price: 35 },
          { ticker: "XPML11", name: "XPML11", brapi_type: "stock", sector: null, close_price: null },
        ],
        has_next_page: true,
      });
      const url = requested_url();
      expect(url.pathname).toBe("/api/quote/list");
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("limit")).toBe("100");
    });

    it("derives has_next_page from totalPages", async () => {
      fetch_mock.mockResolvedValueOnce(json_response({ stocks: [], totalPages: 3 }));
      await expect(fetch_brapi_list_page(2, 10)).resolves.toMatchObject({ has_next_page: true });

      fetch_mock.mockResolvedValueOnce(json_response({ stocks: [], totalPages: 3 }));
      await expect(fetch_brapi_list_page(3, 10)).resolves.toMatchObject({ has_next_page: false });
    });

    it("assumes there is no next page without pagination info", async () => {
      fetch_mock.mockResolvedValue(json_response({ stocks: [] }));
      await expect(fetch_brapi_list_page(1, 10)).resolves.toMatchObject({ has_next_page: false });
    });
  });
});
