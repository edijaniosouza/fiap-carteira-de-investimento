"use client";

import Link from "next/link";
import { ListIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/state_views";
import { AllocationChart } from "@/components/portfolio/allocation_chart";
import { PositionsTable } from "@/components/portfolio/positions_table";
import { SummaryCards } from "@/components/portfolio/summary_cards";
import { Button } from "@/components/ui/button";
import { get_error_message } from "@/store/api/base_api";
import { useGetPortfolioSummaryQuery } from "@/store/api/portfolio_api";

export function PortfolioDetailContainer({ portfolio_id }: { portfolio_id: string }) {
  const { data: summary, isLoading: is_loading, error, refetch } = useGetPortfolioSummaryQuery(portfolio_id);

  if (is_loading) {
    return <LoadingState rows={6} />;
  }
  if (error || !summary) {
    return <ErrorState message={get_error_message(error, "Não foi possível carregar a carteira.")} on_retry={refetch} />;
  }

  const transactions_button = (
    <Button variant="outline" nativeButton={false} render={<Link href={`/portfolios/${portfolio_id}/transactions`} />}>
      <ListIcon /> Transações
    </Button>
  );

  return (
    <>
      <PageHeader
        title={summary.portfolio.name}
        description="Visão consolidada da carteira"
        actions={transactions_button}
      />
      <SummaryCards totals={summary.totals} />
      {summary.positions.length === 0 ? (
        <EmptyState
          title="Carteira sem posições"
          description="Registre transações para ver a posição consolidada."
          action={transactions_button}
        />
      ) : (
        <>
          {summary.allocation_by_type.length > 0 && <AllocationChart allocation={summary.allocation_by_type} />}
          <PositionsTable positions={summary.positions} />
        </>
      )}
    </>
  );
}
