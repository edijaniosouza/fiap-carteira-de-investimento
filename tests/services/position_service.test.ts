import { describe, expect, it } from "vitest";
import { calculate_positions, type PositionTransaction } from "@/services/position_service";

let sequence = 0;

function transaction(
  asset_id: string,
  type: PositionTransaction["type"],
  quantity: number,
  unit_price: number,
  trade_date: string,
): PositionTransaction {
  sequence += 1;
  return {
    id: `t${sequence}`,
    asset_id,
    type,
    quantity,
    unit_price,
    trade_date: new Date(trade_date),
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)),
  };
}

describe("position_service.calculate_positions", () => {
  it("returns an empty list without transactions", () => {
    expect(calculate_positions([])).toEqual([]);
  });

  it("computes average price and cost for buys", () => {
    const [position] = calculate_positions([
      transaction("a", "BUY", 10, 10, "2026-01-01T00:00:00Z"),
      transaction("a", "BUY", 10, 20, "2026-01-11T00:00:00Z"),
    ]);

    expect(position.asset_id).toBe("a");
    expect(position.quantity).toBe(20);
    expect(position.average_price).toBe(15);
    expect(position.total_cost).toBe(300);
    expect(position.realized_result).toBe(0);
    expect(position.average_trade_date).toEqual(new Date("2026-01-06T00:00:00Z"));
  });

  it("keeps the average price on sells and books the realized result", () => {
    const [position] = calculate_positions([
      transaction("a", "BUY", 10, 10, "2026-01-01"),
      transaction("a", "BUY", 10, 20, "2026-01-02"),
      transaction("a", "SELL", 5, 30, "2026-01-03"),
    ]);

    expect(position.quantity).toBe(15);
    expect(position.average_price).toBe(15);
    expect(position.total_cost).toBe(225);
    expect(position.realized_result).toBe(75);
  });

  it("registers losses as negative realized results", () => {
    const [position] = calculate_positions([
      transaction("a", "BUY", 10, 20, "2026-01-01"),
      transaction("a", "SELL", 4, 15, "2026-01-02"),
    ]);
    expect(position.realized_result).toBe(-20);
  });

  it("closes the position when everything is sold", () => {
    const [position] = calculate_positions([
      transaction("a", "BUY", 0.1, 10, "2026-01-01"),
      transaction("a", "BUY", 0.2, 10, "2026-01-01"),
      transaction("a", "SELL", 0.3, 12, "2026-01-02"),
    ]);

    expect(position.quantity).toBe(0);
    expect(position.total_cost).toBe(0);
    expect(position.average_price).toBe(0);
    expect(position.average_trade_date).toBeNull();
    expect(position.realized_result).toBeCloseTo(0.6);
  });

  it("handles a sell without previous buys (average price zero)", () => {
    const [position] = calculate_positions([transaction("a", "SELL", 1, 10, "2026-01-01")]);
    expect(position.quantity).toBe(-1);
    expect(position.realized_result).toBe(10);
    expect(position.average_price).toBe(0);
    expect(position.average_trade_date).toBeNull();
  });

  it("processes the timeline in chronological order", () => {
    const [position] = calculate_positions([
      transaction("a", "SELL", 5, 30, "2026-01-02"),
      transaction("a", "BUY", 10, 10, "2026-01-01"),
    ]);
    expect(position.quantity).toBe(5);
    expect(position.realized_result).toBe(100);
  });

  it("separates positions per asset", () => {
    const positions = calculate_positions([
      transaction("a", "BUY", 1, 10, "2026-01-01"),
      transaction("b", "BUY", 2, 5, "2026-01-01"),
    ]);
    expect(positions.map((position) => [position.asset_id, position.total_cost])).toEqual([
      ["a", 10],
      ["b", 10],
    ]);
  });

  it("moves the average trade date proportionally on partial sells", () => {
    const [position] = calculate_positions([
      transaction("a", "BUY", 10, 10, "2026-01-01T00:00:00Z"),
      transaction("a", "BUY", 10, 10, "2026-01-21T00:00:00Z"),
      transaction("a", "SELL", 10, 10, "2026-02-01T00:00:00Z"),
    ]);
    expect(position.average_trade_date).toEqual(new Date("2026-01-11T00:00:00Z"));
  });
});
