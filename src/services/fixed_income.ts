import type { Indexer } from "@/types/api";

/** Annual index rates in percent (e.g. { CDI: 14.9, IPCA: 5.1 }). */
export type IndexRates = Partial<Record<Indexer, number>>;

const DAYS_PER_YEAR = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Brazilian regressive income tax table for fixed income: the rate of the
 * first bracket whose `max_days` covers the holding period applies.
 */
const INCOME_TAX_BRACKETS: readonly { max_days: number; rate: number }[] = [
  { max_days: 180, rate: 0.225 },
  { max_days: 360, rate: 0.2 },
  { max_days: 720, rate: 0.175 },
];
/** Rate for holding periods longer than the last bracket. */
const LONG_TERM_INCOME_TAX_RATE = 0.15;

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
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Brazilian regressive income tax rate for a fixed income holding period. */
export function income_tax_rate(days: number): number {
  return (
    INCOME_TAX_BRACKETS.find((bracket) => days <= bracket.max_days)?.rate ?? LONG_TERM_INCOME_TAX_RATE
  );
}
