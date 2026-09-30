import type { ReactNode } from "react";
import { SignedValue } from "@/components/common/value_text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format_brl } from "@/lib/format";
import type { PortfolioSummaryDto } from "@/types/api";

type SummaryCardsProps = {
  totals: PortfolioSummaryDto["totals"];
};

function StatCard({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {detail && <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>}
    </Card>
  );
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Valor atual" value={format_brl(totals.current_total)} />
      <StatCard label="Total investido" value={format_brl(totals.invested_total)} detail="Custo das posições abertas" />
      <StatCard
        label="Resultado em aberto"
        value={<SignedValue value={totals.unrealized_result} />}
        detail={<SignedValue value={totals.result_percent} kind="percent" />}
      />
      <StatCard
        label="Resultado realizado"
        value={<SignedValue value={totals.realized_result} />}
        detail="Lucro/prejuízo das vendas"
      />
    </div>
  );
}
