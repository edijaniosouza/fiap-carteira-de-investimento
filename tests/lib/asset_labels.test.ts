import { describe, expect, it } from "vitest";
import {
  ASSET_TYPE_LABELS,
  describe_fixed_income_rate,
  FIXED_INCOME_TYPES,
  INDEXER_LABELS,
  is_variable_income,
  TRANSACTION_TYPE_LABELS,
  VARIABLE_INCOME_TYPES,
} from "@/lib/asset_labels";

describe("asset_labels", () => {
  it("labels every asset type, indexer and transaction type in pt-BR", () => {
    expect(ASSET_TYPE_LABELS.STOCK).toBe("Ação");
    expect(ASSET_TYPE_LABELS.TREASURY).toBe("Tesouro Direto");
    expect(Object.keys(ASSET_TYPE_LABELS)).toHaveLength(7);
    expect(INDEXER_LABELS).toEqual({ PRE: "Prefixado", CDI: "CDI", SELIC: "Selic", IPCA: "IPCA" });
    expect(TRANSACTION_TYPE_LABELS).toEqual({ BUY: "Compra", SELL: "Venda" });
  });

  it("splits investable types into variable and fixed income groups", () => {
    expect(VARIABLE_INCOME_TYPES).toEqual(["STOCK", "FII", "ETF", "BDR"]);
    expect(FIXED_INCOME_TYPES).toEqual(["TREASURY", "CDB"]);
  });

  describe("is_variable_income", () => {
    it.each(["STOCK", "FII", "ETF", "BDR"] as const)("returns true for %s", (type) => {
      expect(is_variable_income(type)).toBe(true);
    });

    it.each(["TREASURY", "CDB", "INDEX"] as const)("returns false for %s", (type) => {
      expect(is_variable_income(type)).toBe(false);
    });
  });

  describe("describe_fixed_income_rate", () => {
    it("returns a dash when indexer or rate is missing", () => {
      expect(describe_fixed_income_rate(null, 10)).toBe("—");
      expect(describe_fixed_income_rate("CDI", null)).toBe("—");
    });

    it("describes percentage-of-index rates for CDI and SELIC", () => {
      expect(describe_fixed_income_rate("CDI", 110)).toBe("110% CDI");
      expect(describe_fixed_income_rate("SELIC", 100.5)).toBe("100,5% Selic");
    });

    it("describes IPCA spreads", () => {
      expect(describe_fixed_income_rate("IPCA", 6.25)).toBe("IPCA + 6,25% a.a.");
    });

    it("describes prefixed annual rates with at most two decimals", () => {
      expect(describe_fixed_income_rate("PRE", 12.3456)).toBe("12,35% a.a.");
    });
  });
});
