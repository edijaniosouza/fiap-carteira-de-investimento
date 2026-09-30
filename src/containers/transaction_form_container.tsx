"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  type TransactionFormDefaults,
  TransactionFormDialog,
  type TransactionFormValues,
} from "@/components/transaction/transaction_form_dialog";
import { AssetPickerContainer } from "@/containers/asset_picker_container";
import { to_local_iso_date } from "@/lib/format";
import { get_error_message } from "@/store/api/base_api";
import { useGetQuoteQuery } from "@/store/api/quote_api";
import {
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
} from "@/store/api/transaction_api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  select_transaction_dialog,
  transaction_dialog_closed,
  type TransactionDialogState,
} from "@/store/slices/ui_slice";
import type { AssetSummaryDto } from "@/types/api";

type OpenDialogState = Extract<TransactionDialogState, { is_open: true }>;

function build_default_values(dialog: OpenDialogState): TransactionFormDefaults {
  if (dialog.mode === "edit") {
    const { transaction } = dialog;
    return {
      type: transaction.type,
      quantity: transaction.quantity,
      unit_price: transaction.unit_price,
      trade_date: transaction.trade_date,
    };
  }
  return { type: "BUY", quantity: "", unit_price: "", trade_date: to_local_iso_date(new Date()) };
}

type TransactionFormContentProps = {
  portfolio_id: string;
  dialog: OpenDialogState;
};

/** Mounted fresh (keyed) every time the dialog opens, so local state starts from the dialog data. */
function TransactionFormContent({ portfolio_id, dialog }: TransactionFormContentProps) {
  const dispatch = useAppDispatch();
  const [selected_asset, set_selected_asset] = useState<AssetSummaryDto | null>(
    dialog.mode === "edit" ? dialog.transaction.asset : dialog.preset_asset,
  );
  const [default_values] = useState(() => build_default_values(dialog));
  const [asset_error, set_asset_error] = useState<string | null>(null);
  const [create_transaction, create_state] = useCreateTransactionMutation();
  const [update_transaction, update_state] = useUpdateTransactionMutation();
  const { data: quote } = useGetQuoteQuery(selected_asset?.id ?? "", { skip: !selected_asset });

  const active_state = dialog.mode === "edit" ? update_state : create_state;
  const close = () => dispatch(transaction_dialog_closed());

  const handle_submit = async (values: TransactionFormValues) => {
    if (!selected_asset) {
      set_asset_error("Selecione um ativo");
      return;
    }
    const body = { ...values, asset_id: selected_asset.id };
    try {
      if (dialog.mode === "edit") {
        await update_transaction({ portfolio_id, transaction_id: dialog.transaction.id, body }).unwrap();
        toast.success("Transação atualizada");
      } else {
        await create_transaction({ portfolio_id, body }).unwrap();
        toast.success("Transação registrada");
      }
      close();
    } catch {
      // Error message is rendered from the mutation state.
    }
  };

  return (
    <TransactionFormDialog
      is_open
      is_editing={dialog.mode === "edit"}
      default_values={default_values}
      current_price={quote?.value ?? null}
      is_pending={active_state.isLoading}
      error_message={active_state.error ? get_error_message(active_state.error) : null}
      asset_error={asset_error}
      asset_picker={
        <AssetPickerContainer
          id="asset_search"
          selected_asset={selected_asset}
          on_select={(asset) => {
            set_asset_error(null);
            set_selected_asset(asset);
          }}
        />
      }
      on_submit={handle_submit}
      on_close={close}
    />
  );
}

export function TransactionFormContainer({ portfolio_id }: { portfolio_id: string }) {
  const dialog = useAppSelector(select_transaction_dialog);
  if (!dialog.is_open) {
    return null;
  }
  const dialog_key = dialog.mode === "edit" ? dialog.transaction.id : `new-${dialog.preset_asset?.id ?? ""}`;
  return <TransactionFormContent key={dialog_key} portfolio_id={portfolio_id} dialog={dialog} />;
}
