import type { Metadata } from "next";
import { PortfolioDetailContainer } from "@/containers/portfolio_detail_container";

export const metadata: Metadata = { title: "Visão da carteira" };

export default async function PortfolioDetailPage({ params }: PageProps<"/portfolios/[id]">) {
  const { id } = await params;
  return <PortfolioDetailContainer portfolio_id={id} />;
}
