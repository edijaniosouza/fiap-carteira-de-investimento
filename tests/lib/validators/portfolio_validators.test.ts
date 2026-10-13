import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  catalog_query_schema,
  portfolio_schema,
  simulation_schema,
  transaction_schema,
  transaction_update_schema,
} from "@/lib/validators/portfolio_validators";

function field_errors(schema: z.ZodType, input: unknown): Record<string, string[] | undefined> {
  const result = schema.safeParse(input);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

describe("portfolio_validators", () => {
  describe("portfolio_schema", () => {
    it("trims the name", () => {
      expect(portfolio_schema.parse({ name: "  Longo prazo " })).toEqual({ name: "Longo prazo" });
    });

    it("rejects empty and long names", () => {
      expect(field_errors(portfolio_schema, { name: "   " })).toEqual({ name: ["Informe o nome da carteira"] });
      expect(field_errors(portfolio_schema, { name: "a".repeat(61) })).toEqual({ name: ["Nome muito longo"] });
    });
  });

  describe("transaction_schema", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const valid_input = {
      asset_id: "asset_1",
      type: "BUY",
      quantity: "10",
      unit_price: "35.5",
      trade_date: "2026-10-13",
    };

    it("coerces numeric strings", () => {
      expect(transaction_schema.parse(valid_input)).toEqual({
        asset_id: "asset_1",
        type: "BUY",
        quantity: 10,
        unit_price: 35.5,
        trade_date: "2026-10-13",
      });
    });

    it("rejects invalid values with pt-BR messages", () => {
      expect(
        field_errors(transaction_schema, {
          asset_id: "",
          type: "HOLD",
          quantity: "0",
          unit_price: "-1",
          trade_date: "13/10/2026",
        }),
      ).toEqual({
        asset_id: ["Selecione um ativo"],
        type: ["Tipo inválido"],
        quantity: ["A quantidade deve ser maior que zero"],
        unit_price: ["O preço deve ser maior que zero"],
        trade_date: ["Data inválida (use AAAA-MM-DD)"],
      });
    });

    it("rejects non-numeric quantity and price", () => {
      const errors = field_errors(transaction_schema, { ...valid_input, quantity: "abc", unit_price: "x" });
      expect(errors.quantity).toEqual(["Quantidade inválida"]);
      expect(errors.unit_price).toEqual(["Preço inválido"]);
    });

    it("rejects future trade dates", () => {
      expect(field_errors(transaction_schema, { ...valid_input, trade_date: "2026-10-14" })).toEqual({
        trade_date: ["A data não pode estar no futuro"],
      });
    });

    it("update schema accepts partial payloads", () => {
      expect(transaction_update_schema.parse({ quantity: "2" })).toEqual({ quantity: 2 });
      expect(transaction_update_schema.parse({})).toEqual({});
    });
  });

  describe("catalog_query_schema", () => {
    it("applies defaults", () => {
      expect(catalog_query_schema.parse({})).toEqual({ type: [], q: "", page: 1, limit: 20 });
    });

    it("splits the comma separated type list", () => {
      expect(catalog_query_schema.parse({ type: "STOCK,,FII", q: " petr ", page: "2", limit: "10" })).toEqual({
        type: ["STOCK", "FII"],
        q: "petr",
        page: 2,
        limit: 10,
      });
    });

    it("rejects unknown types and out of range pagination", () => {
      expect(catalog_query_schema.safeParse({ type: "CRYPTO" }).success).toBe(false);
      expect(catalog_query_schema.safeParse({ page: "0" }).success).toBe(false);
      expect(catalog_query_schema.safeParse({ limit: "51" }).success).toBe(false);
      expect(catalog_query_schema.safeParse({ q: "a".repeat(51) }).success).toBe(false);
    });
  });

  describe("simulation_schema", () => {
    it("coerces amount and months", () => {
      expect(simulation_schema.parse({ asset_id: "a", amount: "1000", months: "12" })).toEqual({
        asset_id: "a",
        amount: 1000,
        months: 12,
      });
    });

    it("validates ranges", () => {
      expect(field_errors(simulation_schema, { asset_id: "", amount: "0", months: "0" })).toEqual({
        asset_id: ["Selecione um ativo"],
        amount: ["O valor deve ser maior que zero"],
        months: ["Prazo mínimo de 1 mês"],
      });
      expect(field_errors(simulation_schema, { asset_id: "a", amount: "2000000000", months: "601" })).toEqual({
        amount: ["Valor muito alto"],
        months: ["Prazo máximo de 600 meses"],
      });
      expect(field_errors(simulation_schema, { asset_id: "a", amount: "x", months: "1.5" })).toEqual({
        amount: ["Valor inválido"],
        months: ["O prazo deve ser um número inteiro de meses"],
      });
    });
  });
});
