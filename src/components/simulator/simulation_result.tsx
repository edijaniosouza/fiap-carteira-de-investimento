import type { ReactNode } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PriceStatusBadge, SignedValue } from "@/components/common/value_text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describe_fixed_income_rate, INDEXER_LABELS } from "@/lib/asset_labels";
import { format_brl, format_number, format_percent } from "@/lib/format";
import type {
  FixedIncomeSimulationDto,
  ScenarioName,
  SimulationDto,
  VariableIncomeSimulationDto,
} from "@/types/api";

const SCENARIO_LABELS: Record<ScenarioName, string> = {
  PESSIMISTIC: "Pessimista",
  BASE: "Base",
  OPTIMISTIC: "Otimista",
};

function ResultRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function short_brl(value: number): string {
  return value.toLocaleString("pt-BR", { notation: "compact", style: "currency", currency: "BRL" });
}

function FixedIncomeResult({ result }: { result: FixedIncomeSimulationDto }) {
  return (
    <>
      <div className="text-sm">
        <ResultRow label="Rentabilidade" value={describe_fixed_income_rate(result.asset.indexer, result.asset.rate)} />
        {result.reference_index && (
          <ResultRow
            label={`${INDEXER_LABELS[result.reference_index.code]} atual`}
            value={`${format_number(result.reference_index.annual_rate)}% a.a.`}
          />
        )}
        <ResultRow label="Taxa efetiva" value={`${format_percent(result.annual_rate)} a.a.`} />
        <ResultRow label="Valor bruto" value={format_brl(result.gross_value)} />
        <ResultRow label="Rendimento bruto" value={<SignedValue value={result.earnings} />} />
        <ResultRow
          label={`IR (${format_percent(result.income_tax_rate)})`}
          value={format_brl(-result.income_tax)}
        />
        <ResultRow label="Valor líquido" value={format_brl(result.net_value)} />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={result.monthly_series}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tickLine={false} fontSize={12} />
            <YAxis tickFormatter={short_brl} width={72} tickLine={false} fontSize={12} />
            <Tooltip formatter={(value) => format_brl(Number(value))} labelFormatter={(month) => `Mês ${month}`} />
            <Line type="monotone" dataKey="value" name="Valor bruto" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function VariableIncomeResult({ result }: { result: VariableIncomeSimulationDto }) {
  return (
    <>
      <div className="text-sm">
        <ResultRow
          label="Cotação atual"
          value={
            <span className="flex items-center gap-2">
              {format_brl(result.current_price)} <PriceStatusBadge status={result.price_status} />
            </span>
          }
        />
        <ResultRow label="Quantidade comprável" value={format_number(result.share_quantity)} />
        <ResultRow label="Valor investido" value={format_brl(result.invested_amount)} />
        <ResultRow label="Sobra" value={format_brl(result.leftover)} />
        {result.scenarios.map((scenario) => (
          <ResultRow
            key={scenario.name}
            label={`${SCENARIO_LABELS[scenario.name]} (${format_percent(scenario.annual_return)} a.a.)`}
            value={
              <span>
                {format_brl(scenario.final_value)} (<SignedValue value={scenario.result} />)
              </span>
            }
          />
        ))}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={result.monthly_series}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tickLine={false} fontSize={12} />
            <YAxis tickFormatter={short_brl} width={72} tickLine={false} fontSize={12} />
            <Tooltip formatter={(value) => format_brl(Number(value))} labelFormatter={(month) => `Mês ${month}`} />
            <Legend />
            <Line type="monotone" dataKey="pessimistic" name="Pessimista" stroke="var(--chart-5)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="base" name="Base" stroke="var(--chart-2)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="optimistic" name="Otimista" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Cenários ilustrativos com retornos anuais fixos; não representam recomendação de investimento.
      </p>
    </>
  );
}

export function SimulationResult({ result }: { result: SimulationDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {result.asset.code} · {format_brl(result.amount)} por {result.months} meses
        </CardTitle>
        <CardDescription>{result.asset.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.kind === "FIXED_INCOME" ? (
          <FixedIncomeResult result={result} />
        ) : (
          <VariableIncomeResult result={result} />
        )}
      </CardContent>
    </Card>
  );
}
