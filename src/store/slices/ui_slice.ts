import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AssetSummaryDto, TransactionDto } from "@/types/api";

export type TransactionDialogState =
  | { is_open: false }
  | { is_open: true; mode: "create"; preset_asset: AssetSummaryDto | null }
  | { is_open: true; mode: "edit"; transaction: TransactionDto };

export type PendingDeletion = {
  kind: "portfolio" | "transaction";
  id: string;
  label: string;
};

export type UiState = {
  transaction_dialog: TransactionDialogState;
  /** Asset chosen in the catalog, to be pre-selected on the next "new transaction" dialog. */
  pending_purchase_asset: AssetSummaryDto | null;
  pending_deletion: PendingDeletion | null;
  portfolio_dialog: { is_open: boolean; editing_portfolio_id: string | null };
};

const initial_state: UiState = {
  transaction_dialog: { is_open: false },
  pending_purchase_asset: null,
  pending_deletion: null,
  portfolio_dialog: { is_open: false, editing_portfolio_id: null },
};

export const ui_slice = createSlice({
  name: "ui",
  initialState: initial_state,
  reducers: {
    create_transaction_dialog_opened(state, action: PayloadAction<AssetSummaryDto | null>) {
      state.transaction_dialog = { is_open: true, mode: "create", preset_asset: action.payload };
      state.pending_purchase_asset = null;
    },
    edit_transaction_dialog_opened(state, action: PayloadAction<TransactionDto>) {
      state.transaction_dialog = { is_open: true, mode: "edit", transaction: action.payload };
    },
    transaction_dialog_closed(state) {
      state.transaction_dialog = { is_open: false };
    },
    purchase_requested(state, action: PayloadAction<AssetSummaryDto>) {
      state.pending_purchase_asset = action.payload;
    },
    deletion_requested(state, action: PayloadAction<PendingDeletion>) {
      state.pending_deletion = action.payload;
    },
    deletion_dismissed(state) {
      state.pending_deletion = null;
    },
    portfolio_dialog_opened(state, action: PayloadAction<string | null>) {
      state.portfolio_dialog = { is_open: true, editing_portfolio_id: action.payload };
    },
    portfolio_dialog_closed(state) {
      state.portfolio_dialog = { is_open: false, editing_portfolio_id: null };
    },
  },
  selectors: {
    select_transaction_dialog: (state) => state.transaction_dialog,
    select_pending_purchase_asset: (state) => state.pending_purchase_asset,
    select_pending_deletion: (state) => state.pending_deletion,
    select_portfolio_dialog: (state) => state.portfolio_dialog,
  },
});

export const {
  create_transaction_dialog_opened,
  edit_transaction_dialog_opened,
  transaction_dialog_closed,
  purchase_requested,
  deletion_requested,
  deletion_dismissed,
  portfolio_dialog_opened,
  portfolio_dialog_closed,
} = ui_slice.actions;

export const {
  select_transaction_dialog,
  select_pending_purchase_asset,
  select_pending_deletion,
  select_portfolio_dialog,
} = ui_slice.selectors;
