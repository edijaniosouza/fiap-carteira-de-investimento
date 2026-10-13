/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { build_asset_summary_dto, build_transaction_dto } from "../../support/factories";
import { AssetPicker } from "@/components/transaction/asset_picker";
import { TransactionFormDialog } from "@/components/transaction/transaction_form_dialog";
import { TransactionTable } from "@/components/transaction/transaction_table";

const asset = build_asset_summary_dto();

describe("AssetPicker", () => {
  const props = {
    id: "asset_search",
    selected_asset: null,
    search_text: "",
    options: [asset, build_asset_summary_dto({ id: "cdb", code: "CDB_110", name: "CDB 110", type: "CDB" })],
    is_searching: false,
    on_search_change: vi.fn(),
    on_select: vi.fn(),
  };

  it("lists options and selects one", async () => {
    const on_select = vi.fn();
    render(<AssetPicker {...props} on_select={on_select} />);

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(within(options[1]).getByText("CDB")).toBeInTheDocument();

    await userEvent.click(within(options[0]).getByRole("button"));
    expect(on_select).toHaveBeenCalledWith(asset);
  });

  it("reports search changes", async () => {
    const on_search_change = vi.fn();
    render(<AssetPicker {...props} on_search_change={on_search_change} />);
    await userEvent.type(screen.getByPlaceholderText("Digite o código ou nome do ativo"), "V");
    expect(on_search_change).toHaveBeenCalledWith("V");
  });

  it("shows the searching state", () => {
    render(<AssetPicker {...props} is_searching />);
    expect(screen.getByText("Buscando...")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("shows the empty state", () => {
    render(<AssetPicker {...props} options={[]} />);
    expect(screen.getByText("Nenhum ativo encontrado")).toBeInTheDocument();
  });

  it("shows the selected asset and allows changing it", async () => {
    const on_select = vi.fn();
    render(<AssetPicker {...props} selected_asset={asset} on_select={on_select} />);

    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("Petrobras PN")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Trocar ativo" }));
    expect(on_select).toHaveBeenCalledWith(null);
  });
});

describe("TransactionTable", () => {
  it("renders transactions and triggers edit and delete", async () => {
    const user = userEvent.setup();
    const buy = build_transaction_dto();
    const sell = build_transaction_dto({ id: "t2", type: "SELL", quantity: 2.5, unit_price: 40, total: 100 });
    const on_edit = vi.fn();
    const on_delete = vi.fn();
    render(<TransactionTable transactions={[buy, sell]} on_edit={on_edit} on_delete={on_delete} />);

    const [buy_row, sell_row] = screen.getAllByRole("row").slice(1);
    expect(within(buy_row).getByText("01/03/2026")).toBeInTheDocument();
    expect(within(buy_row).getByText("Compra")).toBeInTheDocument();
    expect(within(buy_row).getByText("R$ 300,00")).toBeInTheDocument();
    expect(within(sell_row).getByText("Venda")).toBeInTheDocument();
    expect(within(sell_row).getByText("2,5")).toBeInTheDocument();

    await user.click(within(sell_row).getByRole("button", { name: "Editar" }));
    await user.click(within(buy_row).getByRole("button", { name: "Excluir" }));
    expect(on_edit).toHaveBeenCalledWith(sell);
    expect(on_delete).toHaveBeenCalledWith(buy);
  });
});

describe("TransactionFormDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const props = {
    is_open: true,
    is_editing: false,
    default_values: { type: "BUY" as const, quantity: "" as const, unit_price: "" as const, trade_date: "2026-03-01" },
    current_price: null,
    is_pending: false,
    error_message: null,
    asset_error: null,
    asset_picker: <span>picker</span>,
    on_submit: vi.fn(),
    on_close: vi.fn(),
  };

  it("submits a sell with coerced numbers", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<TransactionFormDialog {...props} on_submit={on_submit} />);

    expect(screen.getByText("Nova transação")).toBeInTheDocument();
    expect(screen.getByText("picker")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Venda" }));
    await user.type(screen.getByLabelText("Quantidade"), "5");
    await user.type(screen.getByLabelText("Preço unitário (R$)"), "40.5");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(on_submit).toHaveBeenCalledWith(
        { type: "SELL", quantity: 5, unit_price: 40.5, trade_date: "2026-03-01" },
        expect.anything(),
      ),
    );
  });

  it("validates quantity, price and future dates", async () => {
    const user = userEvent.setup();
    render(<TransactionFormDialog {...props} default_values={{ ...props.default_values, trade_date: "2026-12-01" }} />);

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("A quantidade deve ser maior que zero")).toBeInTheDocument();
    expect(screen.getByText("O preço deve ser maior que zero")).toBeInTheDocument();
    expect(screen.getByText("A data não pode estar no futuro")).toBeInTheDocument();
  });

  it("prefills edit values and shows the current price hint", () => {
    render(
      <TransactionFormDialog
        {...props}
        is_editing
        current_price={35.5}
        default_values={{ type: "SELL", quantity: 3, unit_price: 20, trade_date: "2026-02-01" }}
      />,
    );

    expect(screen.getByText("Editar transação")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Venda" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Quantidade")).toHaveValue(3);
    expect(screen.getByLabelText("Data da operação")).toHaveValue("2026-02-01");
    expect(screen.getByText("Cotação atual: R$ 35,50")).toBeInTheDocument();
  });

  it("shows errors and the pending state", () => {
    render(<TransactionFormDialog {...props} is_pending error_message="Saldo negativo" asset_error="Selecione um ativo" />);
    expect(screen.getByText("Saldo negativo")).toBeInTheDocument();
    expect(screen.getByText("Selecione um ativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("closes from the cancel button and from Escape", async () => {
    const user = userEvent.setup();
    const on_close = vi.fn();
    render(<TransactionFormDialog {...props} on_close={on_close} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.keyboard("{Escape}");

    expect(on_close).toHaveBeenCalledTimes(2);
  });
});
