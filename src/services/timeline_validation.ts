import type { TransactionType } from "@/types/api";

export type TimelineEntry = {
  id: string;
  type: TransactionType;
  quantity: number;
  trade_date: Date;
  created_at: Date;
};

export type TimelineViolation = {
  trade_date: Date;
  balance: number;
};

const QUANTITY_EPSILON = 1e-8;

/**
 * Orders entries chronologically. On the same trade date, buys come before
 * sells (there is no intraday time), then by creation order.
 */
export function sort_timeline<T extends TimelineEntry>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      a.trade_date.getTime() - b.trade_date.getTime() ||
      (a.type === b.type ? 0 : a.type === "BUY" ? -1 : 1) ||
      a.created_at.getTime() - b.created_at.getTime(),
  );
}

/** Returns the first point where the running quantity becomes negative, or null. */
export function find_negative_balance(entries: TimelineEntry[]): TimelineViolation | null {
  let balance = 0;
  for (const entry of sort_timeline(entries)) {
    balance += entry.type === "BUY" ? entry.quantity : -entry.quantity;
    if (balance < -QUANTITY_EPSILON) {
      return { trade_date: entry.trade_date, balance };
    }
  }
  return null;
}
