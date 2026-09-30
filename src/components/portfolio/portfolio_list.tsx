import Link from "next/link";
import { ArrowRightIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format_date } from "@/lib/format";
import type { PortfolioDto } from "@/types/api";

type PortfolioListProps = {
  portfolios: PortfolioDto[];
  on_rename: (portfolio: PortfolioDto) => void;
  on_delete: (portfolio: PortfolioDto) => void;
};

export function PortfolioList({ portfolios, on_rename, on_delete }: PortfolioListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {portfolios.map((portfolio) => (
        <Card key={portfolio.id}>
          <CardHeader>
            <CardTitle>{portfolio.name}</CardTitle>
            <CardDescription>
              Criada em {format_date(portfolio.created_at)} · {portfolio.transaction_count} transação(ões)
            </CardDescription>
            <CardAction className="flex gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Renomear" onClick={() => on_rename(portfolio)}>
                <PencilIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Excluir" onClick={() => on_delete(portfolio)}>
                <Trash2Icon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardFooter className="gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/portfolios/${portfolio.id}`} />}>
              Visão da carteira <ArrowRightIcon />
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/portfolios/${portfolio.id}/transactions`} />}>
              Transações
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
