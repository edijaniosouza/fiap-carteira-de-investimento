/** @vitest-environment jsdom */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { build_portfolio_dto } from "../support/factories";
import { API_ERROR, mutation_result, query_result, render_with_store } from "../support/render_helpers";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/store/api/portfolio_api", () => ({
  useGetPortfoliosQuery: vi.fn(),
  useCreatePortfolioMutation: vi.fn(),
  useRenamePortfolioMutation: vi.fn(),
  useDeletePortfolioMutation: vi.fn(),
}));

import { toast } from "sonner";
import { PortfolioListContainer } from "@/containers/portfolio_list_container";
import {
  useCreatePortfolioMutation,
  useDeletePortfolioMutation,
  useGetPortfoliosQuery,
  useRenamePortfolioMutation,
} from "@/store/api/portfolio_api";
import type { RootState } from "@/store/store";

const portfolio = build_portfolio_dto();

function setup({
  items = [portfolio],
  can_create = false,
  query = undefined as ReturnType<typeof query_result> | undefined,
  create = mutation_result(),
  rename = mutation_result(),
  remove = mutation_result(),
  preloaded_state = undefined as Partial<RootState> | undefined,
} = {}) {
  vi.mocked(useGetPortfoliosQuery).mockReturnValue(
    query ?? query_result({ data: { items, plan: { max_portfolios: 1, can_create } } }),
  );
  vi.mocked(useCreatePortfolioMutation).mockReturnValue(create.tuple);
  vi.mocked(useRenamePortfolioMutation).mockReturnValue(rename.tuple);
  vi.mocked(useDeletePortfolioMutation).mockReturnValue(remove.tuple);
  return { ...render_with_store(<PortfolioListContainer />, preloaded_state), create, rename, remove };
}

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

describe("PortfolioListContainer", () => {
  it("shows loading and error states", async () => {
    const { unmount } = setup({ query: query_result({ isLoading: true }) });
    expect(screen.getByLabelText("Carregando")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova carteira" })).toBeDisabled();
    unmount();

    const query = query_result({ error: API_ERROR });
    setup({ query });
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect((query as unknown as { refetch: () => void }).refetch).toHaveBeenCalled();
  });

  it("shows the empty state with a create action", () => {
    setup({ items: [], can_create: true });
    expect(screen.getByText("Você ainda não tem carteiras")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nova carteira" })).toHaveLength(2);
    expect(screen.queryByText(/plano gratuito/)).not.toBeInTheDocument();
  });

  it("shows the plan limit when creation is not allowed", () => {
    setup();
    expect(screen.getByText(/Seu plano gratuito permite até 1 carteira/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova carteira" })).toBeDisabled();
    expect(screen.getByText("Principal")).toBeInTheDocument();
  });

  it("creates a portfolio", async () => {
    const user = userEvent.setup();
    const { store, create } = setup({ items: [], can_create: true });

    await user.click(screen.getAllByRole("button", { name: "Nova carteira" })[0]);
    expect(screen.getByText("Dê um nome para identificar sua carteira.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome"), "Longo prazo");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Carteira criada"));
    expect(create.trigger).toHaveBeenCalledWith({ name: "Longo prazo" });
    expect(create.reset).toHaveBeenCalled();
    expect(store.getState().ui.portfolio_dialog.is_open).toBe(false);
  });

  it("keeps the dialog open with the error when creation fails", async () => {
    const user = userEvent.setup();
    const create = mutation_result({ error: API_ERROR });
    create.unwrap.mockRejectedValue(API_ERROR);
    const { store } = setup({
      items: [],
      can_create: true,
      create,
      preloaded_state: ui_state({ portfolio_dialog: { is_open: true, editing_portfolio_id: null } }),
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem da API");
    await user.type(screen.getByLabelText("Nome"), "X");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(create.unwrap).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(store.getState().ui.portfolio_dialog.is_open).toBe(true);
  });

  it("renames a portfolio", async () => {
    const user = userEvent.setup();
    const { store, rename } = setup();

    await user.click(screen.getByRole("button", { name: "Renomear" }));
    expect(screen.getByText("Renomear carteira")).toBeInTheDocument();
    const input = screen.getByLabelText("Nome");
    expect(input).toHaveValue("Principal");
    await user.clear(input);
    await user.type(input, "Aposentadoria");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Carteira renomeada"));
    expect(rename.trigger).toHaveBeenCalledWith({ portfolio_id: "portfolio_1", body: { name: "Aposentadoria" } });
    expect(store.getState().ui.portfolio_dialog).toEqual({ is_open: false, editing_portfolio_id: null });
  });

  it("closes the dialog on cancel resetting mutation states", async () => {
    const { store, create, rename } = setup({
      preloaded_state: ui_state({ portfolio_dialog: { is_open: true, editing_portfolio_id: null } }),
    });

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(create.reset).toHaveBeenCalled();
    expect(rename.reset).toHaveBeenCalled();
    expect(store.getState().ui.portfolio_dialog.is_open).toBe(false);
  });

  it("deletes a portfolio after confirmation", async () => {
    const user = userEvent.setup();
    const { store, remove } = setup();

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(screen.getByText('A carteira "Principal" e todas as suas transações serão excluídas.')).toBeInTheDocument();
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Carteira excluída"));
    expect(remove.trigger).toHaveBeenCalledWith("portfolio_1");
    expect(store.getState().ui.pending_deletion).toBeNull();
  });

  it("reports deletion errors", async () => {
    const remove = mutation_result();
    remove.unwrap.mockRejectedValue(API_ERROR);
    const { store } = setup({
      remove,
      preloaded_state: ui_state({ pending_deletion: { kind: "portfolio", id: "portfolio_1", label: "Principal" } }),
    });

    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Mensagem da API"));
    expect(store.getState().ui.pending_deletion).toBeNull();
  });

  it("cancels the deletion", async () => {
    const { store } = setup({
      preloaded_state: ui_state({ pending_deletion: { kind: "portfolio", id: "portfolio_1", label: "Principal" } }),
    });

    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    expect(store.getState().ui.pending_deletion).toBeNull();
  });

  it("ignores transaction deletions and shows the pending state", () => {
    setup({
      remove: mutation_result({ isLoading: true }),
      preloaded_state: ui_state({ pending_deletion: { kind: "transaction", id: "t1", label: "x" } }),
    });
    expect(screen.queryByText("Excluir carteira?")).not.toBeInTheDocument();
  });
});
