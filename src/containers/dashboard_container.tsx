"use client";

import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/state_views";
import { AllocationChart } from "@/components/portfolio/allocation_chart";
import { PositionsTable } from "@/components/portfolio/positions_table";
import { SummaryCards } from "@/components/portfolio/summary_cards";
import { Button } from "@/components/ui/button";
import { get_error_message } from "@/store/api/base_api";
import { useGetPortfolioSummaryQuery, useGetPortfoliosQuery } from "@/store/api/portfolio_api";
import { useAppSelector } from "@/store/hooks";
import { select_current_user } from "@/store/slices/session_slice";

const TOP_POSITIONS = 5;

export function DashboardContainer() {
  const current_user = useAppSelector(select_current_user);
  const portfolios_query = useGetPortfoliosQuery();
  const portfolio = portfolios_query.data?.items[0];
  const summary_query = useGetPortfolioSummaryQuery(portfolio?.id ?? "", { skip: !portfolio });

  const greeting = current_user ? `Olá, ${current_user.name.split(" ")[0]}` : "Dashboard";

  if (portfolios_query.isLoading || summary_query.isLoading) {
    return (
      <>
        <PageHeader title={greeting} description="Resumo dos seus investimentos" />
        <LoadingState rows={6} />
      </>
    );
  }

  const error = portfolios_query.error ?? summary_query.error;
  if (error) {
    return <ErrorState message={get_error_message(error)} on_retry={portfolios_query.refetch} />;
  }

  if (!portfolio) {
    return (
      <>
        <PageHeader title={greeting} description="Resumo dos seus investimentos" />
        <EmptyState
          title="Crie sua primeira carteira"
          description="Com uma carteira você registra compras e vendas e acompanha o resultado."
          action={
            <Button nativeButton={false} render={<Link href="/portfolios" />}>
              <PlusIcon /> Criar carteira
            </Button>
          }
        />
      </>
    );
  }

  const summary = summary_query.data;
  const open_positions = summary?.positions.filter((position) => position.quantity > 0) ?? [];

  return (
    <>
      <PageHeader
        title={greeting}
        description={`Resumo da carteira ${portfolio.name}`}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href={`/portfolios/${portfolio.id}`} />}>
            Visão completa <ArrowRightIcon />
          </Button>
        }
      />
      {summary && <SummaryCards totals={summary.totals} />}
      {summary && summary.allocation_by_type.length > 0 && <AllocationChart allocation={summary.allocation_by_type} />}
      {open_positions.length > 0 ? (
        <PositionsTable positions={open_positions.slice(0, TOP_POSITIONS)} />
      ) : (
        <EmptyState
          title="Nenhuma posição aberta"
          description="Busque ativos no catálogo e registre sua primeira compra."
          action={
            <Button nativeButton={false} render={<Link href="/catalog" />}>
              Ir para o catálogo
            </Button>
          }
        />
      )}
    </>
  );
}
