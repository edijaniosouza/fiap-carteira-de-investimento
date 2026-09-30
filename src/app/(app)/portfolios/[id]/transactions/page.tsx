import type { Metadata } from "next";
import { TransactionListContainer } from "@/containers/transaction_list_container";

export const metadata: Metadata = { title: "Transações" };

export default async function TransactionsPage({ params }: PageProps<"/portfolios/[id]/transactions">) {
  const { id } = await params;
  return <TransactionListContainer portfolio_id={id} />;
}
