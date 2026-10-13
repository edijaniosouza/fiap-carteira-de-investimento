import { describe, expect, it } from "vitest";
import { accrue, days_between, income_tax_rate, resolve_annual_rate } from "@/services/fixed_income";

describe("fixed_income", () => {
  describe("resolve_annual_rate", () => {
    const index_rates = { CDI: 14.9, SELIC: 15, IPCA: 5 };

    it("returns null without indexer", () => {
      expect(resolve_annual_rate(null, 10, index_rates)).toBeNull();
    });

    it("uses the rate itself for PRE", () => {
      expect(resolve_annual_rate("PRE", 12, {})).toBeCloseTo(0.12);
      expect(resolve_annual_rate("PRE", null, {})).toBeNull();
    });

    it("returns null when the index rate is unavailable", () => {
      expect(resolve_annual_rate("CDI", 100, {})).toBeNull();
      expect(resolve_annual_rate("IPCA", 6, { CDI: 10 })).toBeNull();
    });

    it("applies the percentage of CDI and SELIC", () => {
      expect(resolve_annual_rate("CDI", 110, index_rates)).toBeCloseTo(0.1639);
      expect(resolve_annual_rate("SELIC", 100, index_rates)).toBeCloseTo(0.15);
    });

    it("defaults to 100% of the index when the rate is missing", () => {
      expect(resolve_annual_rate("CDI", null, index_rates)).toBeCloseTo(0.149);
    });

    it("compounds the IPCA spread over inflation", () => {
      expect(resolve_annual_rate("IPCA", 6, index_rates)).toBeCloseTo(1.05 * 1.06 - 1);
      expect(resolve_annual_rate("IPCA", null, index_rates)).toBeCloseTo(0.05);
    });
  });

  describe("accrue", () => {
    it("compounds the annual rate on a 365-day basis", () => {
      expect(accrue(1000, 0.1, 365)).toBeCloseTo(1100);
      expect(accrue(1000, 0.1, 730)).toBeCloseTo(1210);
    });

    it("does not accrue for zero or negative days", () => {
      expect(accrue(1000, 0.1, 0)).toBe(1000);
      expect(accrue(1000, 0.1, -30)).toBe(1000);
    });
  });

  describe("days_between", () => {
    it("counts whole days between dates", () => {
      expect(days_between(new Date("2026-01-01"), new Date("2026-01-31"))).toBe(30);
      expect(days_between(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T23:59:59Z"))).toBe(0);
    });

    it("returns negative values when the end is before the start", () => {
      expect(days_between(new Date("2026-01-10"), new Date("2026-01-01"))).toBe(-9);
    });
  });

  describe("income_tax_rate", () => {
    it.each([
      [0, 0.225],
      [180, 0.225],
      [181, 0.2],
      [360, 0.2],
      [361, 0.175],
      [720, 0.175],
      [721, 0.15],
      [3650, 0.15],
    ])("for %i days returns %f", (days, rate) => {
      expect(income_tax_rate(days)).toBe(rate);
    });
  });
});
