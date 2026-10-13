import type { Asset, Portfolio, Quote, Transaction, User } from "@/generated/prisma/client";
import type {
  AssetDto,
  AssetSummaryDto,
  PortfolioDto,
  PortfolioSummaryDto,
  PositionDto,
  TransactionDto,
  UserDto,
} from "@/types/api";

// Prisma Decimal fields are read through Number() by the services, so plain numbers are enough.
type DecimalLike = Asset["rate"];

function as_decimal(value: number): NonNullable<DecimalLike> {
  return value as unknown as NonNullable<DecimalLike>;
}

// ---------- Prisma models ----------

export function build_user(overrides: Partial<User> = {}): User {
  return {
    id: "user_1",
    name: "Maria Silva",
    email: "maria@example.com",
    password_hash: "hashed_password",
    created_at: new Date("2026-01-10T12:00:00.000Z"),
    ...overrides,
  };
}

export function build_asset(
  overrides: Partial<Omit<Asset, "rate">> & { rate?: number | null } = {},
): Asset {
  const { rate = null, ...rest } = overrides;
  return {
    id: "asset_1",
    code: "PETR4",
    name: "Petrobras PN",
    type: "STOCK",
    source: "BRAPI",
    indexer: null,
    maturity_date: null,
    ...rest,
    rate: rate == null ? null : as_decimal(rate),
  };
}

export function build_quote(
  overrides: Partial<Omit<Quote, "value">> & { value?: number } = {},
): Quote {
  const { value = 35, ...rest } = overrides;
  return {
    id: "quote_1",
    asset_id: "asset_1",
    source: "BRAPI",
    updated_at: new Date("2026-10-13T12:00:00.000Z"),
    ...rest,
    value: as_decimal(value),
  };
}

export function build_portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: "portfolio_1",
    user_id: "user_1",
    name: "Principal",
    created_at: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function build_transaction(
  overrides: Partial<Omit<Transaction, "quantity" | "unit_price">> & {
    quantity?: number;
    unit_price?: number;
  } = {},
): Transaction {
  const { quantity = 10, unit_price = 30, ...rest } = overrides;
  return {
    id: "transaction_1",
    portfolio_id: "portfolio_1",
    asset_id: "asset_1",
    type: "BUY",
    trade_date: new Date("2026-03-01T00:00:00.000Z"),
    created_at: new Date("2026-03-01T10:00:00.000Z"),
    ...rest,
    quantity: as_decimal(quantity),
    unit_price: as_decimal(unit_price),
  };
}

// ---------- DTOs ----------

export function build_user_dto(overrides: Partial<UserDto> = {}): UserDto {
  return {
    id: "user_1",
    name: "Maria Silva",
    email: "maria@example.com",
    created_at: "2026-01-10T12:00:00.000Z",
    ...overrides,
  };
}

export function build_asset_summary_dto(overrides: Partial<AssetSummaryDto> = {}): AssetSummaryDto {
  return {
    id: "asset_1",
    code: "PETR4",
    name: "Petrobras PN",
    type: "STOCK",
    indexer: null,
    rate: null,
    ...overrides,
  };
}

export function build_asset_dto(overrides: Partial<AssetDto> = {}): AssetDto {
  return {
    ...build_asset_summary_dto(),
    source: "BRAPI",
    maturity_date: null,
    last_price: 35.5,
    last_price_updated_at: "2026-10-13T12:00:00.000Z",
    ...overrides,
  };
}

export function build_portfolio_dto(overrides: Partial<PortfolioDto> = {}): PortfolioDto {
  return {
    id: "portfolio_1",
    name: "Principal",
    created_at: "2026-02-01T00:00:00.000Z",
    transaction_count: 2,
    ...overrides,
  };
}

export function build_position_dto(overrides: Partial<PositionDto> = {}): PositionDto {
  return {
    asset: build_asset_summary_dto(),
    quantity: 10,
    average_price: 30,
    total_cost: 300,
    current_price: 35,
    current_value: 350,
    unrealized_result: 50,
    realized_result: 0,
    result_percent: 50 / 300,
    price_status: "MARKET",
    price_updated_at: "2026-10-13T12:00:00.000Z",
    ...overrides,
  };
}

export function build_summary_dto(overrides: Partial<PortfolioSummaryDto> = {}): PortfolioSummaryDto {
  return {
    portfolio: build_portfolio_dto(),
    totals: {
      invested_total: 300,
      current_total: 350,
      unrealized_result: 50,
      realized_result: 0,
      result_total: 50,
      result_percent: 50 / 300,
    },
    allocation_by_type: [{ type: "STOCK", value: 350, percent: 1 }],
    positions: [build_position_dto()],
    ...overrides,
  };
}

export function build_transaction_dto(overrides: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: "transaction_1",
    portfolio_id: "portfolio_1",
    asset: build_asset_summary_dto(),
    type: "BUY",
    quantity: 10,
    unit_price: 30,
    total: 300,
    trade_date: "2026-03-01",
    created_at: "2026-03-01T10:00:00.000Z",
    ...overrides,
  };
}
