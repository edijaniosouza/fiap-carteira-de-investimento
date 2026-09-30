import "server-only";
import type { Asset, Quote } from "@/generated/prisma/client";
import type { AssetSource } from "@/generated/prisma/enums";
import { is_variable_income } from "@/lib/asset_labels";
import { prisma } from "@/lib/prisma";
import type { IndexRates } from "@/services/fixed_income";
import { fetch_bcb_index_rate, is_bcb_index_code } from "@/services/market/bcb_client";
import { fetch_brapi_price } from "@/services/market/brapi_client";
import type { QuoteDto } from "@/types/api";

export const QUOTE_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CONCURRENT_FETCHES = 4;

export type QuotableAsset = Pick<Asset, "id" | "code" | "type">;

export type QuoteResult = {
  asset_id: string;
  value: number;
  source: AssetSource;
  updated_at: Date;
  is_stale: boolean;
};

const in_flight_refreshes = new Map<string, Promise<QuoteResult | null>>();

function to_quote_result(quote: Quote, is_stale: boolean): QuoteResult {
  return {
    asset_id: quote.asset_id,
    value: Number(quote.value),
    source: quote.source,
    updated_at: quote.updated_at,
    is_stale,
  };
}

export function to_quote_dto(quote: QuoteResult): QuoteDto {
  return { ...quote, updated_at: quote.updated_at.toISOString() };
}

function is_fresh(updated_at: Date): boolean {
  return Date.now() - updated_at.getTime() < QUOTE_CACHE_TTL_MS;
}

async function fetch_remote_price(
  asset: QuotableAsset,
): Promise<{ value: number; source: AssetSource } | null> {
  if (is_variable_income(asset.type)) {
    return { value: await fetch_brapi_price(asset.code), source: "BRAPI" };
  }
  if (asset.type === "INDEX" && is_bcb_index_code(asset.code)) {
    return { value: await fetch_bcb_index_rate(asset.code), source: "BCB" };
  }
  // Treasury bonds (seed CSV) and CDBs have no free real-time source.
  return null;
}

async function refresh_quote(asset: QuotableAsset, cached: Quote | null): Promise<QuoteResult | null> {
  try {
    const remote = await fetch_remote_price(asset);
    if (!remote) {
      return cached ? to_quote_result(cached, false) : null;
    }
    const now = new Date();
    const saved = await prisma.quote.upsert({
      where: { asset_id: asset.id },
      create: { asset_id: asset.id, value: remote.value, source: remote.source, updated_at: now },
      update: { value: remote.value, source: remote.source, updated_at: now },
    });
    console.info(`[market_data] ${asset.code} refreshed from ${remote.source}`);
    return to_quote_result(saved, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[market_data] failed to refresh ${asset.code}: ${message}`);
    return cached ? to_quote_result(cached, true) : null;
  }
}

/** Returns the quote from the database cache (30 min TTL) or refreshes it from the source. */
export async function get_quote(asset: QuotableAsset): Promise<QuoteResult | null> {
  const cached = await prisma.quote.findUnique({ where: { asset_id: asset.id } });
  if (cached && is_fresh(cached.updated_at)) {
    return to_quote_result(cached, false);
  }

  const pending = in_flight_refreshes.get(asset.id) ?? refresh_quote(asset, cached);
  in_flight_refreshes.set(asset.id, pending);
  try {
    return await pending;
  } finally {
    in_flight_refreshes.delete(asset.id);
  }
}

export async function get_quotes(assets: QuotableAsset[]): Promise<Map<string, QuoteResult>> {
  const quotes = new Map<string, QuoteResult>();
  for (let start = 0; start < assets.length; start += MAX_CONCURRENT_FETCHES) {
    const chunk = assets.slice(start, start + MAX_CONCURRENT_FETCHES);
    const results = await Promise.all(chunk.map((asset) => get_quote(asset)));
    results.forEach((quote) => {
      if (quote) {
        quotes.set(quote.asset_id, quote);
      }
    });
  }
  return quotes;
}

/** Current annual rates (percent) of CDI, SELIC and IPCA, read through the quote cache. */
export async function get_index_rates(): Promise<IndexRates> {
  const index_assets = await prisma.asset.findMany({
    where: { type: "INDEX", code: { in: ["CDI", "SELIC", "IPCA"] } },
  });
  const quotes = await get_quotes(index_assets);
  const index_rates: IndexRates = {};
  for (const asset of index_assets) {
    const quote = quotes.get(asset.id);
    if (quote && is_bcb_index_code(asset.code)) {
      index_rates[asset.code] = quote.value;
    }
  }
  return index_rates;
}
