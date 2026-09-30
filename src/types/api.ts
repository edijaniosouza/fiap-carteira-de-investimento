// DTOs shared between Route Handlers (server) and RTK Query (client).
// All JSON fields follow snake_case.
import type {
  AssetSource,
  AssetType,
  Indexer,
  TransactionType,
} from "@/generated/prisma/enums";

export type { AssetSource, AssetType, Indexer, TransactionType };

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// ---------- Auth ----------

export type UserDto = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type SignUpRequest = { name: string; email: string; password: string };
export type SignInRequest = { email: string; password: string };
export type ForgotPasswordRequest = { email: string };
export type ResetPasswordRequest = { token: string; password: string };
export type UpdateProfileRequest = {
  name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
};
export type MessageResponse = { message: string };

// ---------- Catalog ----------

export type AssetDto = {
  id: string;
  code: string;
  name: string;
  type: AssetType;
  source: AssetSource;
  indexer: Indexer | null;
  rate: number | null;
  maturity_date: string | null;
  last_price: number | null;
  last_price_updated_at: string | null;
};

export type CatalogQuery = {
  type?: string;
  q?: string;
  page?: number;
  limit?: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

// ---------- Quotes ----------

export type QuoteDto = {
  asset_id: string;
  value: number;
  source: AssetSource;
  updated_at: string;
  is_stale: boolean;
};

// ---------- Portfolios ----------

export type PortfolioDto = {
  id: string;
  name: string;
  created_at: string;
  transaction_count: number;
};

export type PortfolioListResponse = {
  items: PortfolioDto[];
  plan: {
    max_portfolios: number;
    can_create: boolean;
  };
};

export type PortfolioRequest = { name: string };

export type PriceStatus = "MARKET" | "STALE" | "ESTIMATED" | "UNAVAILABLE";

export type AssetSummaryDto = Pick<AssetDto, "id" | "code" | "name" | "type" | "indexer" | "rate">;

export type PositionDto = {
  asset: AssetSummaryDto;
  quantity: number;
  average_price: number;
  total_cost: number;
  current_price: number | null;
  current_value: number;
  unrealized_result: number;
  realized_result: number;
  result_percent: number;
  price_status: PriceStatus;
  price_updated_at: string | null;
};

export type AllocationDto = {
  type: AssetType;
  value: number;
  percent: number;
};

export type PortfolioSummaryDto = {
  portfolio: PortfolioDto;
  totals: {
    invested_total: number;
    current_total: number;
    unrealized_result: number;
    realized_result: number;
    result_total: number;
    result_percent: number;
  };
  allocation_by_type: AllocationDto[];
  positions: PositionDto[];
};

// ---------- Transactions ----------

export type TransactionDto = {
  id: string;
  portfolio_id: string;
  asset: AssetSummaryDto;
  type: TransactionType;
  quantity: number;
  unit_price: number;
  total: number;
  trade_date: string;
  created_at: string;
};

export type TransactionRequest = {
  asset_id: string;
  type: TransactionType;
  quantity: number;
  unit_price: number;
  trade_date: string;
};

// ---------- Simulations ----------

export type SimulationRequest = {
  asset_id: string;
  amount: number;
  months: number;
};

export type FixedIncomeSimulationDto = {
  kind: "FIXED_INCOME";
  asset: AssetSummaryDto;
  amount: number;
  months: number;
  annual_rate: number;
  reference_index: { code: Indexer; annual_rate: number } | null;
  gross_value: number;
  earnings: number;
  income_tax_rate: number;
  income_tax: number;
  net_value: number;
  monthly_series: { month: number; value: number }[];
};

export type ScenarioName = "PESSIMISTIC" | "BASE" | "OPTIMISTIC";

export type VariableIncomeSimulationDto = {
  kind: "VARIABLE_INCOME";
  asset: AssetSummaryDto;
  amount: number;
  months: number;
  current_price: number;
  price_status: PriceStatus;
  share_quantity: number;
  invested_amount: number;
  leftover: number;
  scenarios: { name: ScenarioName; annual_return: number; final_value: number; result: number }[];
  monthly_series: { month: number; pessimistic: number; base: number; optimistic: number }[];
};

export type SimulationDto = FixedIncomeSimulationDto | VariableIncomeSimulationDto;
