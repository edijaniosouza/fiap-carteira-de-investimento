import { beforeEach, describe, expect, it, vi } from "vitest";
import { BCB_SERIES, fetch_bcb_index_rate, is_bcb_index_code } from "@/services/market/bcb_client";

const fetch_mock = vi.fn();

function json_response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("bcb_client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetch_mock);
  });

  it("maps index codes to SGS series", () => {
    expect(BCB_SERIES).toEqual({ CDI: 4389, SELIC: 432, IPCA: 13522 });
  });

  it("fetches the latest value of the series and parses the decimal comma", async () => {
    fetch_mock.mockResolvedValue(json_response([{ data: "10/10/2026", valor: "14,90" }]));

    await expect(fetch_bcb_index_rate("CDI")).resolves.toBe(14.9);

    const [url, init] = fetch_mock.mock.calls[0];
    expect(url).toBe("https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json");
    expect(init).toMatchObject({ cache: "no-store" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the last item of the payload", async () => {
    fetch_mock.mockResolvedValue(
      json_response([
        { data: "09/10/2026", valor: "4.1" },
        { data: "10/10/2026", valor: "4.2" },
      ]),
    );
    await expect(fetch_bcb_index_rate("IPCA")).resolves.toBe(4.2);
  });

  it("throws on HTTP errors", async () => {
    fetch_mock.mockResolvedValue(json_response({}, 503));
    await expect(fetch_bcb_index_rate("SELIC")).rejects.toThrow("BCB SGS request failed with status 503");
  });

  it("throws on unexpected payloads", async () => {
    fetch_mock.mockResolvedValue(json_response([]));
    await expect(fetch_bcb_index_rate("CDI")).rejects.toThrow();
  });

  it("throws when the value is not numeric", async () => {
    fetch_mock.mockResolvedValue(json_response([{ data: "10/10/2026", valor: "abc" }]));
    await expect(fetch_bcb_index_rate("CDI")).rejects.toThrow("BCB SGS returned an invalid value for CDI");
  });

  it("identifies BCB index codes", () => {
    expect(is_bcb_index_code("CDI")).toBe(true);
    expect(is_bcb_index_code("SELIC")).toBe(true);
    expect(is_bcb_index_code("IPCA")).toBe(true);
    expect(is_bcb_index_code("PETR4")).toBe(false);
  });
});
