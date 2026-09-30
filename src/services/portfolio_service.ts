import "server-only";
import type { z } from "zod";
import type { Asset, Portfolio } from "@/generated/prisma/client";
import { is_variable_income } from "@/lib/asset_labels";
import { AppError, not_found_error } from "@/lib/errors";
import { FREE_PLAN_LIMITS } from "@/lib/free_plan";
import { prisma } from "@/lib/prisma";
import type { portfolio_schema } from "@/lib/validators/portfolio_validators";
import { to_asset_summary_dto } from "@/services/catalog_service";
import {
  accrue,
  days_between,
  type IndexRates,
  resolve_annual_rate,
} from "@/services/fixed_income";
import {
  get_index_rates,
  get_quotes,
  type QuoteResult,
} from "@/services/market/market_data_service";
import { calculate_positions, type PositionCore } from "@/services/position_service";
import type {
  AllocationDto,
  AssetType,
  PortfolioDto,
  PortfolioListResponse,
  PortfolioSummaryDto,
  PositionDto,
  PriceStatus,
} from "@/types/api";

function round_money(value: number): number {
  return Math.round(value * 100) / 100;
}

function round_quantity(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function to_portfolio_dto(portfolio: Portfolio, transaction_count: number): PortfolioDto {
  return {
    id: portfolio.id,
    name: portfolio.name,
    created_at: portfolio.created_at.toISOString(),
    transaction_count,
  };
}

/** Loads a portfolio owned by the user. Foreign portfolios answer 404 to avoid leaking ids. */
export async function get_owned_portfolio(user_id: string, portfolio_id: string): Promise<Portfolio> {
  const portfolio = await prisma.portfolio.findFirst({ where: { id: portfolio_id, user_id } });
  if (!portfolio) {
    throw not_found_error("Carteira não encontrada");
  }
  return portfolio;
}

export async function list_portfolios(user_id: string): Promise<PortfolioListResponse> {
  const portfolios = await prisma.portfolio.findMany({
    where: { user_id },
    include: { _count: { select: { transactions: true } } },
    orderBy: { created_at: "asc" },
  });
  return {
    items: portfolios.map((portfolio) => to_portfolio_dto(portfolio, portfolio._count.transactions)),
    plan: {
      max_portfolios: FREE_PLAN_LIMITS.max_portfolios,
      can_create: portfolios.length < FREE_PLAN_LIMITS.max_portfolios,
    },
  };
}

export async function create_portfolio(
  user_id: string,
  input: z.infer<typeof portfolio_schema>,
): Promise<PortfolioDto> {
  const portfolio_count = await prisma.portfolio.count({ where: { user_id } });
  if (portfolio_count >= FREE_PLAN_LIMITS.max_portfolios) {
    throw new AppError(
      403,
      "PLAN_LIMIT_REACHED",
      `O plano gratuito permite até ${FREE_PLAN_LIMITS.max_portfolios} carteira(s)`,
    );
  }
  const portfolio = await prisma.portfolio.create({ data: { user_id, name: input.name } });
  return to_portfolio_dto(portfolio, 0);
}

export async function rename_portfolio(
  user_id: string,
  portfolio_id: string,
  input: z.infer<typeof portfolio_schema>,
): Promise<PortfolioDto> {
  await get_owned_portfolio(user_id, portfolio_id);
  const portfolio = await prisma.portfolio.update({
    where: { id: portfolio_id },
    data: { name: input.name },
    include: { _count: { select: { transactions: true } } },
  });
  return to_portfolio_dto(portfolio, portfolio._count.transactions);
}

export async function delete_portfolio(user_id: string, portfolio_id: string): Promise<void> {
  await get_owned_portfolio(user_id, portfolio_id);
  await prisma.portfolio.delete({ where: { id: portfolio_id } });
}

// ---------- Positions ----------

type PriceInfo = {
  current_price: number | null;
  price_status: PriceStatus;
  price_updated_at: string | null;
};

function price_position(
  core: PositionCore,
  asset: Asset,
  quote: QuoteResult | undefined,
  index_rates: IndexRates,
): PriceInfo {
  if (quote) {
    return {
      current_price: quote.value,
      price_status: quote.is_stale ? "STALE" : "MARKET",
      price_updated_at: quote.updated_at.toISOString(),
    };
  }
  if (!is_variable_income(asset.type) && core.average_trade_date) {
    const annual_rate = resolve_annual_rate(
      asset.indexer,
      asset.rate == null ? null : Number(asset.rate),
      index_rates,
    );
    if (annual_rate != null) {
      const days = days_between(core.average_trade_date, new Date());
      return {
        current_price: accrue(core.average_price, annual_rate, days),
        price_status: "ESTIMATED",
        price_updated_at: null,
      };
    }
  }
  return { current_price: null, price_status: "UNAVAILABLE", price_updated_at: null };
}

function to_position_dto(core: PositionCore, asset: Asset, price: PriceInfo): PositionDto {
  const current_value =
    price.current_price == null ? core.total_cost : core.quantity * price.current_price;
  const unrealized_result = current_value - core.total_cost;
  return {
    asset: to_asset_summary_dto(asset),
    quantity: round_quantity(core.quantity),
    average_price: round_quantity(core.average_price),
    total_cost: round_money(core.total_cost),
    current_price: price.current_price == null ? null : round_quantity(price.current_price),
    current_value: round_money(current_value),
    unrealized_result: round_money(unrealized_result),
    realized_result: round_money(core.realized_result),
    result_percent: core.total_cost > 0 ? unrealized_result / core.total_cost : 0,
    price_status: price.price_status,
    price_updated_at: price.price_updated_at,
  };
}

async function build_positions(portfolio_id: string): Promise<PositionDto[]> {
  const transactions = await prisma.transaction.findMany({
    where: { portfolio_id },
    include: { asset: true },
  });
  const assets = new Map(transactions.map((transaction) => [transaction.asset_id, transaction.asset]));
  const cores = calculate_positions(
    transactions.map((transaction) => ({
      id: transaction.id,
      asset_id: transaction.asset_id,
      type: transaction.type,
      quantity: Number(transaction.quantity),
      unit_price: Number(transaction.unit_price),
      trade_date: transaction.trade_date,
      created_at: transaction.created_at,
    })),
  );

  const open_assets = cores
    .filter((core) => core.quantity > 0)
    .map((core) => assets.get(core.asset_id) as Asset);
  const quotes = await get_quotes(open_assets);
  const has_fixed_income = open_assets.some((asset) => !is_variable_income(asset.type));
  const index_rates = has_fixed_income ? await get_index_rates() : {};

  return cores
    .map((core) => {
      const asset = assets.get(core.asset_id) as Asset;
      const price: PriceInfo =
        core.quantity > 0
          ? price_position(core, asset, quotes.get(core.asset_id), index_rates)
          : { current_price: null, price_status: "UNAVAILABLE", price_updated_at: null };
      return to_position_dto(core, asset, price);
    })
    .sort((a, b) => b.current_value - a.current_value || a.asset.code.localeCompare(b.asset.code));
}

export async function get_positions(user_id: string, portfolio_id: string): Promise<PositionDto[]> {
  await get_owned_portfolio(user_id, portfolio_id);
  return build_positions(portfolio_id);
}

function build_allocation(open_positions: PositionDto[], current_total: number): AllocationDto[] {
  const value_by_type = new Map<AssetType, number>();
  for (const position of open_positions) {
    value_by_type.set(
      position.asset.type,
      (value_by_type.get(position.asset.type) ?? 0) + position.current_value,
    );
  }
  return [...value_by_type.entries()]
    .map(([type, value]) => ({
      type,
      value: round_money(value),
      percent: current_total > 0 ? value / current_total : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export async function get_portfolio_summary(
  user_id: string,
  portfolio_id: string,
): Promise<PortfolioSummaryDto> {
  await get_owned_portfolio(user_id, portfolio_id);
  const [portfolio, positions] = await Promise.all([
    prisma.portfolio.findUniqueOrThrow({
      where: { id: portfolio_id },
      include: { _count: { select: { transactions: true } } },
    }),
    build_positions(portfolio_id),
  ]);

  const open_positions = positions.filter((position) => position.quantity > 0);
  const invested_total = open_positions.reduce((sum, position) => sum + position.total_cost, 0);
  const current_total = open_positions.reduce((sum, position) => sum + position.current_value, 0);
  const unrealized_result = current_total - invested_total;
  const realized_result = positions.reduce((sum, position) => sum + position.realized_result, 0);

  return {
    portfolio: to_portfolio_dto(portfolio, portfolio._count.transactions),
    totals: {
      invested_total: round_money(invested_total),
      current_total: round_money(current_total),
      unrealized_result: round_money(unrealized_result),
      realized_result: round_money(realized_result),
      result_total: round_money(unrealized_result + realized_result),
      result_percent: invested_total > 0 ? unrealized_result / invested_total : 0,
    },
    allocation_by_type: build_allocation(open_positions, current_total),
    positions,
  };
}
