import { describe, expect, it } from "vitest";
import { find_negative_balance, sort_timeline, type TimelineEntry } from "@/services/timeline_validation";

function entry(
  id: string,
  type: TimelineEntry["type"],
  quantity: number,
  trade_date: string,
  created_at = "2026-01-01T00:00:00Z",
): TimelineEntry {
  return { id, type, quantity, trade_date: new Date(trade_date), created_at: new Date(created_at) };
}

describe("timeline_validation", () => {
  describe("sort_timeline", () => {
    it("orders by trade date", () => {
      const entries = [entry("b", "BUY", 1, "2026-02-01"), entry("a", "BUY", 1, "2026-01-01")];
      expect(sort_timeline(entries).map((item) => item.id)).toEqual(["a", "b"]);
    });

    it("puts buys before sells on the same day", () => {
      const entries = [entry("sell", "SELL", 1, "2026-01-01"), entry("buy", "BUY", 1, "2026-01-01")];
      expect(sort_timeline(entries).map((item) => item.id)).toEqual(["buy", "sell"]);
    });

    it("keeps buys first regardless of the original position", () => {
      const entries = [entry("buy", "BUY", 1, "2026-01-01"), entry("sell", "SELL", 1, "2026-01-01")];
      expect(sort_timeline(entries).map((item) => item.id)).toEqual(["buy", "sell"]);
    });

    it("uses creation order for same day and type", () => {
      const entries = [
        entry("late", "BUY", 1, "2026-01-01", "2026-01-01T10:00:00Z"),
        entry("early", "BUY", 1, "2026-01-01", "2026-01-01T09:00:00Z"),
      ];
      expect(sort_timeline(entries).map((item) => item.id)).toEqual(["early", "late"]);
    });

    it("does not mutate the input array", () => {
      const entries = [entry("b", "BUY", 1, "2026-02-01"), entry("a", "BUY", 1, "2026-01-01")];
      sort_timeline(entries);
      expect(entries.map((item) => item.id)).toEqual(["b", "a"]);
    });
  });

  describe("find_negative_balance", () => {
    it("returns null for an empty timeline", () => {
      expect(find_negative_balance([])).toBeNull();
    });

    it("returns null when the balance never goes negative", () => {
      const entries = [
        entry("1", "BUY", 10, "2026-01-01"),
        entry("2", "SELL", 4, "2026-01-02"),
        entry("3", "SELL", 6, "2026-01-03"),
      ];
      expect(find_negative_balance(entries)).toBeNull();
    });

    it("accepts a sell on the same day as the buy", () => {
      const entries = [entry("s", "SELL", 5, "2026-01-01"), entry("b", "BUY", 5, "2026-01-01")];
      expect(find_negative_balance(entries)).toBeNull();
    });

    it("returns the first violation point", () => {
      const entries = [
        entry("1", "BUY", 10, "2026-01-05"),
        entry("2", "SELL", 3, "2026-01-01"),
        entry("3", "SELL", 20, "2026-01-10"),
      ];
      expect(find_negative_balance(entries)).toEqual({ trade_date: new Date("2026-01-01"), balance: -3 });
    });

    it("tolerates floating point residues", () => {
      const entries = [
        entry("1", "BUY", 0.1, "2026-01-01"),
        entry("2", "BUY", 0.2, "2026-01-01"),
        entry("3", "SELL", 0.3, "2026-01-02"),
      ];
      expect(find_negative_balance(entries)).toBeNull();
    });
  });
});
