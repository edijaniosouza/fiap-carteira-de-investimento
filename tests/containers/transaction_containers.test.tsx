/** @vitest-environment jsdom */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { build_asset_summary_dto, build_summary_dto, build_transaction_dto } from "../support/factories";
import { API_ERROR, mutation_result, query_result, render_with_store } from "../support/render_helpers";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/store/api/transaction_api", () => ({
  useGetTransactionsQuery: vi.fn(),
  useCreateTransactionMutation: vi.fn(),
  useUpdateTransactionMutation: vi.fn(),
  useDeleteTransactionMutation: vi.fn(),
}));
vi.mock("@/store/api/portfolio_api", () => ({ useGetPortfolioSummaryQuery: vi.fn() }));
vi.mock("@/store/api/quote_api", () => ({ useGetQuoteQuery: vi.fn() }));
vi.mock("@/store/api/catalog_api", () => ({ useGetCatalogQuery: vi.fn() }));

import { toast } from "sonner";
import { TransactionFormContainer } from "@/containers/transaction_form_container";
import { TransactionListContainer } from "@/containers/transaction_list_container";
import { useGetCatalogQuery } from "@/store/api/catalog_api";
import { useGetPortfolioSummaryQuery } from "@/store/api/portfolio_api";
import { useGetQuoteQuery } from "@/store/api/quote_api";
import {
  useCreateTransactionMutation,
  useDeleteTransactionMutation,
  useGetTransactionsQuery,
  useUpdateTransactionMutation,
} from "@/store/api/transaction_api";
import {
  create_transaction_dialog_opened,
  edit_transaction_dialog_opened,
} from "@/store/slices/ui_slice";
import type { RootState } from "@/store/store";

const asset = build_asset_summary_dto();
const transaction = build_transaction_dto();

function ui_state(overrides: Partial<RootState["ui"]>): Partial<RootState> {
  return {
    ui: {
      transaction_dialog: { is_open: false },
      pending_purchase_asset: null,
      pending_deletion: null,
      portfolio_dialog: { is_open: false, editing_portfolio_id: null },
      ...overrides,
    },
  };
}

function mock_form_hooks({ create = mutation_result(), update = mutation_result(), quote_value = null as number | null } = {}) {
  vi.mocked(useCreateTransactionMutation).mockReturnValue(create.tuple);
  vi.mocked(useUpdateTransactionMutation).mockReturnValue(update.tuple);
  vi.mocked(useGetQuoteQuery).mockReturnValue(query_result({ data: quote_value == null ? undefined : { value: quote_value } }));
  vi.mocked(useGetCatalogQuery).mockReturnValue(query_result({ data: { items: [asset] } }));
  return { create, update };
}

async function fill_quantity_and_price(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Quantidade"), "10");
  await user.type(screen.getByLabelText("Preço unitário (R$)"), "35");
  await user.click(screen.getByRole("button", { name: "Salvar" }));
}

describe("TransactionFormContainer", () => {
  it("renders nothing while the dialog is closed", () => {
    mock_form_hooks();
    const { container } = render_with_store(<TransactionFormContainer portfolio_id="portfolio_1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("creates a transaction for the preset asset with today's date", async () => {
    const user = userEvent.setup();
    const { create } = mock_form_hooks({ quote_value: 35.5 });
    const { store } = render_with_store(<TransactionFormContainer portfolio_id="portfolio_1" />, {
      ...ui_state({ transaction_dialog: { is_open: true, mode: "create", preset_asset: asset } }),
    });

    expect(screen.getByText("Nova transação")).toBeInTheDocument();
    expect(screen.getByText("Cotação atual: R$ 35,50")).toBeInTheDocument();
    expect(useGetQuoteQuery).toHaveBeenCalledWith("asset_1", { skip: false });
    const today = screen.getByLabelText("Data da operação") as HTMLInputElement;
    expect(today.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await fill_quantity_and_price(user);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Transação registrada"));
    expect(create.trigger).toHaveBeenCalledWith({
      portfolio_id: "portfolio_1",
      body: { type: "BUY", quantity: 10, unit_price: 35, trade_date: today.value, asset_id: "asset_1" },
    });
    expect(store.getState().ui.transaction_dialog).toEqual({ is_open: false });
  });

  it("requires an asset", async () => {
    const user = userEvent.setup();
    const { create } = mock_form_hooks();
    render_with_store(<TransactionFormContainer portfolio_id="portfolio_1" />, {
      ...ui_state({ transaction_dialog: { is_open: true, mode: "create", preset_asset: null } }),
    });

    expect(useGetQuoteQuery).toHaveBeenCalledWith("", { skip: true });
    await fill_quantity_and_price(user);

    expect(await screen.findByText("Selecione um ativo")).toBeInTheDocument();
    expect(create.trigger).not.toHaveBeenCalled();

    await user.click(screen.getByText("PETR4"));
    expect(screen.queryByText("Selecione um ativo")).not.toBeInTheDocument();
  });

  it("updates an existing transaction", async () => {
    const user = userEvent.setup();
    const { update } = mock_form_hooks();
    render_with_store(<TransactionFormContainer portfolio_id="portfolio_1" />, {
      ...ui_state({ transaction_dialog: { is_open: true, mode: "edit", transaction } }),
    });

    expect(screen.getByText("Editar transação")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade")).toHaveValue(10);
    await user.clear(screen.getByLabelText("Quantidade"));
    await user.type(screen.getByLabelText("Quantidade"), "12");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Transação atualizada"));
    expect(update.trigger).toHaveBeenCalledWith({
      portfolio_id: "portfolio_1",
      transaction_id: "transaction_1",
      body: { type: "BUY", quantity: 12, unit_price: 30, trade_date: "2026-03-01", asset_id: "asset_1" },
    });
  });

  it("keeps the dialog open with the API error when saving fails", async () => {
    const user = userEvent.setup();
    const update = mutation_result({ error: API_ERROR });
    update.unwrap.mockRejectedValue(API_ERROR);
    mock_form_hooks({ update });
    const { store } = render_with_store(<TransactionFormContainer portfolio_id="portfolio_1" />, {
      ...ui_state({ transaction_dialog: { is_open: true, mode: "edit", transaction } }),
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem da API");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(update.unwrap).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(store.getState().ui.transaction_dialog.is_open).toBe(true);
  });

  it("closes from the cancel button", async () => {
    mock_form_hooks();
    const { store } = render_with_store(<TransactionFormContainer portfolio_id="portfolio_1" />, {
      ...ui_state({ transaction_dialog: { is_open: true, mode: "create", preset_asset: null } }),
    });

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(store.getState().ui.transaction_dialog).toEqual({ is_open: false });
  });

  it("remounts with fresh state when a different dialog opens", () => {
    mock_form_hooks();
    const { store } = render_with_store(<TransactionFormContainer portfolio_id="portfolio_1" />, {
      ...ui_state({ transaction_dialog: { is_open: true, mode: "create", preset_asset: null } }),
    });

    act(() => {
      store.dispatch(edit_transaction_dialog_opened(transaction));
    });
    expect(screen.getByText("Editar transação")).toBeInTheDocument();

    act(() => {
      store.dispatch(create_transaction_dialog_opened(asset));
    });
    expect(screen.getByText("Nova transação")).toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
  });
});

describe("TransactionListContainer", () => {
  function setup({
    transactions = query_result({ data: [transaction] }),
    remove = mutation_result(),
    preloaded_state = undefined as Partial<RootState> | undefined,
  } = {}) {
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result({ data: build_summary_dto() }));
    vi.mocked(useGetTransactionsQuery).mockReturnValue(transactions);
    vi.mocked(useDeleteTransactionMutation).mockReturnValue(remove.tuple);
    mock_form_hooks();
    return { ...render_with_store(<TransactionListContainer portfolio_id="portfolio_1" />, preloaded_state), remove };
  }

  it("lists transactions with the portfolio name", () => {
    setup();
    expect(screen.getByText("Carteira Principal")).toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(useGetTransactionsQuery).toHaveBeenCalledWith("portfolio_1");
  });

  it("shows loading, error and empty states", async () => {
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result());
    const loading = setup({ transactions: query_result({ isLoading: true }) });
    expect(screen.getByLabelText("Carregando")).toBeInTheDocument();
    loading.unmount();

    const failing = query_result({ error: API_ERROR });
    const error_view = setup({ transactions: failing });
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect((failing as unknown as { refetch: () => void }).refetch).toHaveBeenCalled();
    error_view.unmount();

    setup({ transactions: query_result({ data: [] }) });
    expect(screen.getByText("Nenhuma transação registrada")).toBeInTheDocument();
  });

  it("opens the create dialog from the header button", async () => {
    const { store } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Nova transação" }));
    expect(store.getState().ui.transaction_dialog).toEqual({ is_open: true, mode: "create", preset_asset: null });
    expect(screen.getByText("Registre uma compra ou venda de ativo nesta carteira.")).toBeInTheDocument();
  });

  it("opens the create dialog for a purchase requested in the catalog", () => {
    const { store } = setup({ preloaded_state: ui_state({ pending_purchase_asset: asset }) });
    expect(store.getState().ui.transaction_dialog).toEqual({ is_open: true, mode: "create", preset_asset: asset });
    expect(store.getState().ui.pending_purchase_asset).toBeNull();
  });

  it("opens the edit dialog", async () => {
    const { store } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(store.getState().ui.transaction_dialog).toEqual({ is_open: true, mode: "edit", transaction });
  });

  it("deletes a transaction after confirmation", async () => {
    const user = userEvent.setup();
    const { store, remove } = setup();

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("A transação PETR4 de 2026-03-01 será removida e as posições recalculadas.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Transação excluída"));
    expect(remove.trigger).toHaveBeenCalledWith({ portfolio_id: "portfolio_1", transaction_id: "transaction_1" });
    expect(store.getState().ui.pending_deletion).toBeNull();
  });

  it("reports deletion errors", async () => {
    const remove = mutation_result();
    remove.unwrap.mockRejectedValue(API_ERROR);
    setup({
      remove,
      preloaded_state: ui_state({ pending_deletion: { kind: "transaction", id: "transaction_1", label: "PETR4" } }),
    });

    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Mensagem da API"));
  });

  it("cancels the deletion", async () => {
    const { store } = setup({
      preloaded_state: ui_state({ pending_deletion: { kind: "transaction", id: "transaction_1", label: "PETR4" } }),
    });

    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    expect(store.getState().ui.pending_deletion).toBeNull();
  });
});
