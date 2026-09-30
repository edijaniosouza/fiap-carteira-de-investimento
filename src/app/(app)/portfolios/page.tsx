import type { Metadata } from "next";
import { PortfolioListContainer } from "@/containers/portfolio_list_container";

export const metadata: Metadata = { title: "Carteiras" };

export default function PortfoliosPage() {
  return <PortfolioListContainer />;
}
