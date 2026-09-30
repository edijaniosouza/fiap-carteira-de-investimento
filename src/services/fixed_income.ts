import type { Indexer } from "@/types/api";

/** Annual index rates in percent (e.g. { CDI: 14.9, IPCA: 5.1 }). */
export type IndexRates = Partial<Record<Indexer, number>>;

const DAYS_PER_YEAR = 365;

/**
 * Resolves the effective annual rate (ratio, 0.12 = 12%) of a fixed income asset.
 * - PRE: rate is the annual rate itself.
 * - CDI/SELIC: rate is the percentage of the index (110 = 110% of CDI).
 * - IPCA: rate is the real spread over IPCA.
 * Returns null when the required index rate is not available.
 */
export function resolve_annual_rate(
  indexer: Indexer | null,
  rate: number | null,
  index_rates: IndexRates,
): number | null {
  if (!indexer) {
    return null;
  }
  if (indexer === "PRE") {
    return rate == null ? null : rate / 100;
  }
  const index_rate = index_rates[indexer];
  if (index_rate == null) {
    return null;
  }
  if (indexer === "IPCA") {
    return (1 + index_rate / 100) * (1 + (rate ?? 0) / 100) - 1;
  }
  return (index_rate / 100) * ((rate ?? 100) / 100);
}

export function accrue(value: number, annual_rate: number, days: number): number {
  return value * Math.pow(1 + annual_rate, Math.max(days, 0) / DAYS_PER_YEAR);
}

export function days_between(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

/** Brazilian regressive income tax table for fixed income. */
export function income_tax_rate(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}
