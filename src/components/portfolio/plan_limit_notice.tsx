import { InfoIcon } from "lucide-react";

export function PlanLimitNotice({ max_portfolios }: { max_portfolios: number }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <InfoIcon className="size-4 shrink-0" />
      Seu plano gratuito permite até {max_portfolios} carteira(s). Exclua uma carteira para criar outra.
    </p>
  );
}
