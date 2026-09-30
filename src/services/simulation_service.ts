import "server-only";
import type { z } from "zod";
import type { Asset } from "@/generated/prisma/client";
import { is_variable_income } from "@/lib/asset_labels";
import { AppError } from "@/lib/errors";
import type { simulation_schema } from "@/lib/validators/portfolio_validators";
import { get_investable_asset, to_asset_summary_dto } from "@/services/catalog_service";
import { income_tax_rate, resolve_annual_rate } from "@/services/fixed_income";
import { get_index_rates, get_quote } from "@/services/market/market_data_service";
import type {
  FixedIncomeSimulationDto,
  ScenarioName,
  SimulationDto,
  VariableIncomeSimulationDto,
} from "@/types/api";

type SimulationInput = z.infer<typeof simulation_schema>;

const DAYS_PER_MONTH = 30;

/** Mock annual returns used to project variable income scenarios. */
const VARIABLE_INCOME_SCENARIOS: { name: ScenarioName; annual_return: number }[] = [
  { name: "PESSIMISTIC", annual_return: -0.1 },
  { name: "BASE", annual_return: 0.08 },
  { name: "OPTIMISTIC", annual_return: 0.2 },
];

function round_money(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthly_rate_from_annual(annual_rate: number): number {
  return Math.pow(1 + annual_rate, 1 / 12) - 1;
}

async function simulate_fixed_income(
  asset: Asset,
  input: SimulationInput,
): Promise<FixedIncomeSimulationDto> {
  const index_rates = await get_index_rates();
  const annual_rate = resolve_annual_rate(
    asset.indexer,
    asset.rate == null ? null : Number(asset.rate),
    index_rates,
  );
  if (annual_rate == null) {
    throw new AppError(
      422,
      "QUOTE_UNAVAILABLE",
      "Taxa de referência indisponível no momento para simular este ativo",
    );
  }

  const monthly_rate = monthly_rate_from_annual(annual_rate);
  const monthly_series = Array.from({ length: input.months + 1 }, (_, month) => ({
    month,
    value: round_money(input.amount * Math.pow(1 + monthly_rate, month)),
  }));
  const gross_value = monthly_series[monthly_series.length - 1].value;
  const earnings = gross_value - input.amount;
  const tax_rate = income_tax_rate(input.months * DAYS_PER_MONTH);
  const income_tax = Math.max(earnings, 0) * tax_rate;
  const reference_rate =
    asset.indexer && asset.indexer !== "PRE" ? index_rates[asset.indexer] : undefined;

  return {
    kind: "FIXED_INCOME",
    asset: to_asset_summary_dto(asset),
    amount: input.amount,
    months: input.months,
    annual_rate,
    reference_index:
      asset.indexer && reference_rate != null
        ? { code: asset.indexer, annual_rate: reference_rate }
        : null,
    gross_value,
    earnings: round_money(earnings),
    income_tax_rate: tax_rate,
    income_tax: round_money(income_tax),
    net_value: round_money(gross_value - income_tax),
    monthly_series,
  };
}

async function simulate_variable_income(
  asset: Asset,
  input: SimulationInput,
): Promise<VariableIncomeSimulationDto> {
  const quote = await get_quote(asset);
  if (!quote || quote.value <= 0) {
    throw new AppError(422, "QUOTE_UNAVAILABLE", `Cotação de ${asset.code} indisponível no momento`);
  }

  const share_quantity = Math.floor(input.amount / quote.value);
  const invested_amount = share_quantity * quote.value;
  const leftover = input.amount - invested_amount;
  const project = (annual_return: number, month: number) =>
    round_money(invested_amount * Math.pow(1 + annual_return, month / 12) + leftover);

  const [pessimistic, base, optimistic] = VARIABLE_INCOME_SCENARIOS;
  return {
    kind: "VARIABLE_INCOME",
    asset: to_asset_summary_dto(asset),
    amount: input.amount,
    months: input.months,
    current_price: quote.value,
    price_status: quote.is_stale ? "STALE" : "MARKET",
    share_quantity,
    invested_amount: round_money(invested_amount),
    leftover: round_money(leftover),
    scenarios: VARIABLE_INCOME_SCENARIOS.map((scenario) => {
      const final_value = project(scenario.annual_return, input.months);
      return { ...scenario, final_value, result: round_money(final_value - input.amount) };
    }),
    monthly_series: Array.from({ length: input.months + 1 }, (_, month) => ({
      month,
      pessimistic: project(pessimistic.annual_return, month),
      base: project(base.annual_return, month),
      optimistic: project(optimistic.annual_return, month),
    })),
  };
}

export async function run_simulation(input: SimulationInput): Promise<SimulationDto> {
  const asset = await get_investable_asset(input.asset_id);
  return is_variable_income(asset.type)
    ? simulate_variable_income(asset, input)
    : simulate_fixed_income(asset, input);
}
