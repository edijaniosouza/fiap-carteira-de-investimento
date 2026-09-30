import type { AssetType, Indexer, TransactionType } from "@/types/api";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  STOCK: "Ação",
  FII: "FII",
  ETF: "ETF",
  BDR: "BDR",
  TREASURY: "Tesouro Direto",
  CDB: "CDB",
  INDEX: "Índice",
};

export const INDEXER_LABELS: Record<Indexer, string> = {
  PRE: "Prefixado",
  CDI: "CDI",
  SELIC: "Selic",
  IPCA: "IPCA",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  BUY: "Compra",
  SELL: "Venda",
};

export const VARIABLE_INCOME_TYPES: AssetType[] = ["STOCK", "FII", "ETF", "BDR"];
export const FIXED_INCOME_TYPES: AssetType[] = ["TREASURY", "CDB"];

export function is_variable_income(type: AssetType): boolean {
  return VARIABLE_INCOME_TYPES.includes(type);
}

export function describe_fixed_income_rate(indexer: Indexer | null, rate: number | null): string {
  if (!indexer || rate == null) {
    return "—";
  }
  const formatted_rate = rate.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  switch (indexer) {
    case "CDI":
    case "SELIC":
      return `${formatted_rate}% ${INDEXER_LABELS[indexer]}`;
    case "IPCA":
      return `IPCA + ${formatted_rate}% a.a.`;
    case "PRE":
      return `${formatted_rate}% a.a.`;
  }
}
