import { sort_timeline, type TimelineEntry } from "@/services/timeline_validation";

export type PositionTransaction = TimelineEntry & {
  asset_id: string;
  unit_price: number;
};

export type PositionCore = {
  asset_id: string;
  quantity: number;
  average_price: number;
  total_cost: number;
  realized_result: number;
  /** Quantity-weighted purchase date of the open position (used to accrue fixed income). */
  average_trade_date: Date | null;
};

const QUANTITY_EPSILON = 1e-8;

type Accumulator = {
  quantity: number;
  total_cost: number;
  realized_result: number;
  weighted_time_sum: number;
};

function apply_transaction(acc: Accumulator, transaction: PositionTransaction): void {
  const { quantity, unit_price } = transaction;
  if (transaction.type === "BUY") {
    acc.quantity += quantity;
    acc.total_cost += quantity * unit_price;
    acc.weighted_time_sum += quantity * transaction.trade_date.getTime();
    return;
  }
  // Average cost method: selling does not change the average price.
  const average_price = acc.quantity > 0 ? acc.total_cost / acc.quantity : 0;
  const sold_ratio = acc.quantity > 0 ? quantity / acc.quantity : 0;
  acc.realized_result += quantity * (unit_price - average_price);
  acc.total_cost -= quantity * average_price;
  acc.weighted_time_sum -= acc.weighted_time_sum * sold_ratio;
  acc.quantity -= quantity;
  if (Math.abs(acc.quantity) < QUANTITY_EPSILON) {
    acc.quantity = 0;
    acc.total_cost = 0;
    acc.weighted_time_sum = 0;
  }
}

/** Consolidates transactions into one position per asset (average cost method). */
export function calculate_positions(transactions: PositionTransaction[]): PositionCore[] {
  const accumulators = new Map<string, Accumulator>();

  for (const transaction of sort_timeline(transactions)) {
    const acc = accumulators.get(transaction.asset_id) ?? {
      quantity: 0,
      total_cost: 0,
      realized_result: 0,
      weighted_time_sum: 0,
    };
    apply_transaction(acc, transaction);
    accumulators.set(transaction.asset_id, acc);
  }

  return [...accumulators.entries()].map(([asset_id, acc]) => ({
    asset_id,
    quantity: acc.quantity,
    average_price: acc.quantity > 0 ? acc.total_cost / acc.quantity : 0,
    total_cost: acc.total_cost,
    realized_result: acc.realized_result,
    average_trade_date: acc.quantity > 0 ? new Date(acc.weighted_time_sum / acc.quantity) : null,
  }));
}
