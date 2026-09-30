import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ASSET_TYPE_LABELS } from "@/lib/asset_labels";
import { format_brl, format_percent } from "@/lib/format";
import type { AllocationDto } from "@/types/api";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type AllocationChartProps = {
  allocation: AllocationDto[];
};

export function AllocationChart({ allocation }: AllocationChartProps) {
  const chart_data = allocation.map((item) => ({ ...item, label: ASSET_TYPE_LABELS[item.type] }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alocação por tipo</CardTitle>
        <CardDescription>Distribuição do valor atual da carteira</CardDescription>
      </CardHeader>
      <CardContent className="grid items-center gap-4 sm:grid-cols-2">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chart_data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="90%" paddingAngle={2}>
                {chart_data.map((item, index) => (
                  <Cell key={item.type} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => format_brl(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-2 text-sm">
          {chart_data.map((item, index) => (
            <li key={item.type} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className="size-3 rounded-sm"
                  style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                  aria-hidden
                />
                {item.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {format_percent(item.percent)} · {format_brl(item.value)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
