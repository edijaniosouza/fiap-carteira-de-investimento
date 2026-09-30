import { cn } from "@/lib/utils";
import { format_brl, format_percent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { PriceStatus } from "@/types/api";

type SignedValueProps = {
  value: number;
  kind?: "brl" | "percent";
  class_name?: string;
};

/** Money/percent colored by sign (gain in green, loss in red). */
export function SignedValue({ value, kind = "brl", class_name }: SignedValueProps) {
  const text = kind === "brl" ? format_brl(value) : format_percent(value);
  return (
    <span
      className={cn(
        "tabular-nums",
        value > 0 && "text-emerald-600 dark:text-emerald-400",
        value < 0 && "text-destructive",
        class_name,
      )}
    >
      {value > 0 ? "+" : ""}
      {text}
    </span>
  );
}

const PRICE_STATUS_LABELS: Record<PriceStatus, string> = {
  MARKET: "Mercado",
  STALE: "Desatualizada",
  ESTIMATED: "Estimada",
  UNAVAILABLE: "Indisponível",
};

const PRICE_STATUS_HINTS: Record<PriceStatus, string> = {
  MARKET: "Cotação de mercado (cache de até 30 min)",
  STALE: "Fonte indisponível: exibindo a última cotação salva",
  ESTIMATED: "Valor estimado pela taxa atual do indexador",
  UNAVAILABLE: "Sem cotação: valor atual considerado igual ao custo",
};

export function PriceStatusBadge({ status }: { status: PriceStatus }) {
  return (
    <Badge variant={status === "MARKET" ? "secondary" : "outline"} title={PRICE_STATUS_HINTS[status]}>
      {PRICE_STATUS_LABELS[status]}
    </Badge>
  );
}
