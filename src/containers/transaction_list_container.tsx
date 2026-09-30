"use client";

import { useEffect } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm_dialog";
import { PageHeader } from "@/components/common/page_header";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/state_views";
import { TransactionTable } from "@/components/transaction/transaction_table";
import { Button } from "@/components/ui/button";
import { TransactionFormContainer } from "@/containers/transaction_form_container";
import { get_error_message } from "@/store/api/base_api";
import { useGetPortfolioSummaryQuery } from "@/store/api/portfolio_api";
import {
  useDeleteTransactionMutation,
  useGetTransactionsQuery,
} from "@/store/api/transaction_api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  create_transaction_dialog_opened,
  deletion_dismissed,
  deletion_requested,
  edit_transaction_dialog_opened,
  select_pending_deletion,
  select_pending_purchase_asset,
} from "@/store/slices/ui_slice";
import type { TransactionDto } from "@/types/api";

export function TransactionListContainer({ portfolio_id }: { portfolio_id: string }) {
  const dispatch = useAppDispatch();
  const pending_purchase_asset = useAppSelector(select_pending_purchase_asset);
  const pending_deletion = useAppSelector(select_pending_deletion);
  const { data: summary } = useGetPortfolioSummaryQuery(portfolio_id);
  const {
    data: transactions,
    isLoading: is_loading,
    error,
    refetch,
  } = useGetTransactionsQuery(portfolio_id);
  const [delete_transaction, { isLoading: is_deleting }] = useDeleteTransactionMutation();

  // "Registrar compra" in the catalog stores the asset in Redux and navigates here.
  useEffect(() => {
    if (pending_purchase_asset) {
      dispatch(create_transaction_dialog_opened(pending_purchase_asset));
    }
  }, [dispatch, pending_purchase_asset]);

  const open_create_dialog = () => dispatch(create_transaction_dialog_opened(null));
  const request_delete = (transaction: TransactionDto) =>
    dispatch(
      deletion_requested({
        kind: "transaction",
        id: transaction.id,
        label: `${transaction.asset.code} de ${transaction.trade_date}`,
      }),
    );

  const confirm_delete = async () => {
    if (!pending_deletion) return;
    try {
      await delete_transaction({ portfolio_id, transaction_id: pending_deletion.id }).unwrap();
      toast.success("Transação excluída");
    } catch (delete_error) {
      toast.error(get_error_message(delete_error));
    } finally {
      dispatch(deletion_dismissed());
    }
  };

  const new_transaction_button = (
    <Button onClick={open_create_dialog}>
      <PlusIcon /> Nova transação
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Transações"
        description={summary ? `Carteira ${summary.portfolio.name}` : undefined}
        actions={new_transaction_button}
      />
      {is_loading && <LoadingState rows={5} />}
      {error && <ErrorState message={get_error_message(error)} on_retry={refetch} />}
      {transactions && transactions.length === 0 && (
        <EmptyState
          title="Nenhuma transação registrada"
          description="Registre sua primeira compra para acompanhar a carteira."
          action={new_transaction_button}
        />
      )}
      {transactions && transactions.length > 0 && (
        <TransactionTable
          transactions={transactions}
          on_edit={(transaction) => dispatch(edit_transaction_dialog_opened(transaction))}
          on_delete={request_delete}
        />
      )}
      <TransactionFormContainer portfolio_id={portfolio_id} />
      <ConfirmDialog
        is_open={pending_deletion?.kind === "transaction"}
        title="Excluir transação?"
        description={`A transação ${pending_deletion?.label ?? ""} será removida e as posições recalculadas.`}
        is_pending={is_deleting}
        on_confirm={confirm_delete}
        on_cancel={() => dispatch(deletion_dismissed())}
      />
    </>
  );
}
