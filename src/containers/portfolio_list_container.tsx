"use client";

import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm_dialog";
import { PageHeader } from "@/components/common/page_header";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/state_views";
import { PlanLimitNotice } from "@/components/portfolio/plan_limit_notice";
import {
  PortfolioFormDialog,
  type PortfolioFormValues,
} from "@/components/portfolio/portfolio_form_dialog";
import { PortfolioList } from "@/components/portfolio/portfolio_list";
import { Button } from "@/components/ui/button";
import { get_error_message } from "@/store/api/base_api";
import {
  useCreatePortfolioMutation,
  useDeletePortfolioMutation,
  useGetPortfoliosQuery,
  useRenamePortfolioMutation,
} from "@/store/api/portfolio_api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  deletion_dismissed,
  deletion_requested,
  portfolio_dialog_closed,
  portfolio_dialog_opened,
  select_pending_deletion,
  select_portfolio_dialog,
} from "@/store/slices/ui_slice";

export function PortfolioListContainer() {
  const dispatch = useAppDispatch();
  const portfolio_dialog = useAppSelector(select_portfolio_dialog);
  const pending_deletion = useAppSelector(select_pending_deletion);
  const { data, isLoading: is_loading, error, refetch } = useGetPortfoliosQuery();
  const [create_portfolio, create_state] = useCreatePortfolioMutation();
  const [rename_portfolio, rename_state] = useRenamePortfolioMutation();
  const [delete_portfolio, { isLoading: is_deleting }] = useDeletePortfolioMutation();

  const editing_portfolio = data?.items.find(
    (portfolio) => portfolio.id === portfolio_dialog.editing_portfolio_id,
  );
  const form_state = editing_portfolio ? rename_state : create_state;
  const can_create = data?.plan.can_create ?? false;

  const close_dialog = () => {
    create_state.reset();
    rename_state.reset();
    dispatch(portfolio_dialog_closed());
  };

  const handle_submit = async (values: PortfolioFormValues) => {
    try {
      if (editing_portfolio) {
        await rename_portfolio({ portfolio_id: editing_portfolio.id, body: values }).unwrap();
        toast.success("Carteira renomeada");
      } else {
        await create_portfolio(values).unwrap();
        toast.success("Carteira criada");
      }
      close_dialog();
    } catch {
      // Error message is rendered from the mutation state.
    }
  };

  const confirm_delete = async () => {
    if (!pending_deletion) return;
    try {
      await delete_portfolio(pending_deletion.id).unwrap();
      toast.success("Carteira excluída");
    } catch (delete_error) {
      toast.error(get_error_message(delete_error));
    } finally {
      dispatch(deletion_dismissed());
    }
  };

  const create_button = (
    <Button disabled={!can_create} onClick={() => dispatch(portfolio_dialog_opened(null))}>
      <PlusIcon /> Nova carteira
    </Button>
  );

  return (
    <>
      <PageHeader title="Carteiras" description="Organize seus investimentos em carteiras" actions={create_button} />
      {data && !can_create && <PlanLimitNotice max_portfolios={data.plan.max_portfolios} />}
      {is_loading && <LoadingState />}
      {error && <ErrorState message={get_error_message(error)} on_retry={refetch} />}
      {data && data.items.length === 0 && (
        <EmptyState
          title="Você ainda não tem carteiras"
          description="Crie sua carteira para começar a registrar investimentos."
          action={create_button}
        />
      )}
      {data && data.items.length > 0 && (
        <PortfolioList
          portfolios={data.items}
          on_rename={(portfolio) => dispatch(portfolio_dialog_opened(portfolio.id))}
          on_delete={(portfolio) =>
            dispatch(deletion_requested({ kind: "portfolio", id: portfolio.id, label: portfolio.name }))
          }
        />
      )}
      <PortfolioFormDialog
        is_open={portfolio_dialog.is_open}
        is_editing={Boolean(editing_portfolio)}
        initial_name={editing_portfolio?.name ?? ""}
        is_pending={form_state.isLoading}
        error_message={form_state.error ? get_error_message(form_state.error) : null}
        on_submit={handle_submit}
        on_close={close_dialog}
      />
      <ConfirmDialog
        is_open={pending_deletion?.kind === "portfolio"}
        title="Excluir carteira?"
        description={`A carteira "${pending_deletion?.label ?? ""}" e todas as suas transações serão excluídas.`}
        is_pending={is_deleting}
        on_confirm={confirm_delete}
        on_cancel={() => dispatch(deletion_dismissed())}
      />
    </>
  );
}
