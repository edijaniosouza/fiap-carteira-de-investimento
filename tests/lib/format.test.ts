import { describe, expect, it } from "vitest";
import {
  format_brl,
  format_date,
  format_date_time,
  format_number,
  format_percent,
  to_local_iso_date,
} from "@/lib/format";

// Intl uses a non-breaking space between the currency symbol and the value.
function normalize_spaces(text: string): string {
  return text.replace(/\s/g, " ");
}

describe("format", () => {
  describe("format_brl", () => {
    it("formats numbers as Brazilian currency", () => {
      expect(normalize_spaces(format_brl(1234.5))).toBe("R$ 1.234,50");
      expect(normalize_spaces(format_brl(0))).toBe("R$ 0,00");
      expect(normalize_spaces(format_brl(-10))).toBe("-R$ 10,00");
    });

    it("returns a dash for null and undefined", () => {
      expect(format_brl(null)).toBe("—");
      expect(format_brl(undefined)).toBe("—");
    });
  });

  describe("format_percent", () => {
    it("formats ratios with two decimals", () => {
      // ICU versions differ on the space before "%", so it is ignored here.
      expect(format_percent(0.1234).replace(/\s/g, "")).toBe("12,34%");
      expect(format_percent(-0.05).replace(/\s/g, "")).toBe("-5,00%");
    });

    it("returns a dash for missing values", () => {
      expect(format_percent(null)).toBe("—");
      expect(format_percent(undefined)).toBe("—");
    });
  });

  describe("format_number", () => {
    it("formats numbers with up to 8 decimals", () => {
      expect(format_number(1234.5)).toBe("1.234,5");
      expect(format_number(0.123456789)).toBe("0,12345679");
    });

    it("returns a dash for missing values", () => {
      expect(format_number(null)).toBe("—");
      expect(format_number(undefined)).toBe("—");
    });
  });

  describe("format_date", () => {
    it("formats ISO dates as dd/mm/yyyy in UTC", () => {
      expect(format_date("2026-03-01")).toBe("01/03/2026");
      expect(format_date("2026-12-31T23:59:59.000Z")).toBe("31/12/2026");
    });

    it("returns a dash for empty values", () => {
      expect(format_date(null)).toBe("—");
      expect(format_date(undefined)).toBe("—");
      expect(format_date("")).toBe("—");
    });
  });

  describe("format_date_time", () => {
    it("formats a date with short date and time", () => {
      const local_date = new Date(2026, 2, 1, 14, 30);
      expect(format_date_time(local_date.toISOString())).toBe("01/03/2026, 14:30");
    });

    it("returns a dash for empty values", () => {
      expect(format_date_time(null)).toBe("—");
      expect(format_date_time(undefined)).toBe("—");
    });
  });

  describe("to_local_iso_date", () => {
    it("uses the local calendar date with zero padding", () => {
      expect(to_local_iso_date(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
      expect(to_local_iso_date(new Date(2026, 10, 25))).toBe("2026-11-25");
    });
  });
});
