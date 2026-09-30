import { z } from "zod";

// External payloads keep brapi's own camelCase field names; we only read them here.
const BRAPI_BASE_URL = "https://brapi.dev/api";
const REQUEST_TIMEOUT_MS = 8_000;

const quote_response_schema = z.object({
  results: z.array(
    z.object({
      symbol: z.string(),
      regularMarketPrice: z.number().nullable().optional(),
    }),
  ),
});

const list_response_schema = z.object({
  stocks: z.array(
    z.object({
      stock: z.string(),
      name: z.string().nullable().optional(),
      close: z.number().nullable().optional(),
      type: z.string().nullable().optional(),
      sector: z.string().nullable().optional(),
    }),
  ),
  hasNextPage: z.boolean().optional(),
  totalPages: z.number().optional(),
});

export type BrapiListedAsset = {
  ticker: string;
  name: string;
  brapi_type: string;
  sector: string | null;
  close_price: number | null;
};

function build_url(path: string, params: Record<string, string>): string {
  const url = new URL(`${BRAPI_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const token = process.env.BRAPI_TOKEN;
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

async function fetch_json(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`brapi request failed with status ${response.status}`);
  }
  return response.json();
}

/** Free plan allows one ticker per request, so callers fetch one at a time. */
export async function fetch_brapi_price(ticker: string): Promise<number> {
  const payload = quote_response_schema.parse(
    await fetch_json(build_url(`/quote/${encodeURIComponent(ticker)}`, {})),
  );
  const price = payload.results[0]?.regularMarketPrice;
  if (price == null) {
    throw new Error(`brapi returned no price for ${ticker}`);
  }
  return price;
}

export async function fetch_brapi_list_page(
  page: number,
  limit: number,
): Promise<{ assets: BrapiListedAsset[]; has_next_page: boolean }> {
  const payload = list_response_schema.parse(
    await fetch_json(build_url("/quote/list", { page: String(page), limit: String(limit) })),
  );
  return {
    assets: payload.stocks.map((item) => ({
      ticker: item.stock,
      name: item.name ?? item.stock,
      brapi_type: item.type ?? "stock",
      sector: item.sector ?? null,
      close_price: item.close ?? null,
    })),
    has_next_page: payload.hasNextPage ?? page < (payload.totalPages ?? page),
  };
}
