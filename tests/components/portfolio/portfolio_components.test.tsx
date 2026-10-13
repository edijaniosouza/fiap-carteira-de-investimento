/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { build_portfolio_dto, build_position_dto, build_summary_dto } from "../../support/factories";
import { AllocationChart } from "@/components/portfolio/allocation_chart";
import { PlanLimitNotice } from "@/components/portfolio/plan_limit_notice";
import { PortfolioFormDialog } from "@/components/portfolio/portfolio_form_dialog";
import { PortfolioList } from "@/components/portfolio/portfolio_list";
import { PositionsTable } from "@/components/portfolio/positions_table";
import { SummaryCards } from "@/components/portfolio/summary_cards";

describe("AllocationChart", () => {
  it("lists every asset type with percent and value", () => {
    render(
      <AllocationChart
        allocation={[
          { type: "STOCK", value: 750, percent: 0.75 },
          { type: "CDB", value: 250, percent: 0.25 },
        ]}
      />,
    );

    expect(screen.getByText("Alocação por tipo")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Ação");
    expect(items[0]).toHaveTextContent(/75,00\s?% · R\$\s750,00/);
    expect(items[1]).toHaveTextContent("CDB");
  });
});

describe("PlanLimitNotice", () => {
  it("explains the free plan limit", () => {
    render(<PlanLimitNotice max_portfolios={1} />);
    expect(screen.getByText(/permite até 1 carteira\(s\)/)).toBeInTheDocument();
  });
});

describe("PortfolioList", () => {
  const portfolio = build_portfolio_dto();

  it("renders each portfolio with links and actions", async () => {
    const user = userEvent.setup();
    const on_rename = vi.fn();
    const on_delete = vi.fn();
    render(<PortfolioList portfolios={[portfolio]} on_rename={on_rename} on_delete={on_delete} />);

    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Criada em 01/02/2026 · 2 transação(ões)")).toBeInTheDocument();
    // Base UI renders the Link-based buttons with role="button".
    expect(screen.getByRole("button", { name: /Visão da carteira/ })).toHaveAttribute("href", "/portfolios/portfolio_1");
    expect(screen.getByRole("button", { name: "Transações" })).toHaveAttribute(
      "href",
      "/portfolios/portfolio_1/transactions",
    );

    await user.click(screen.getByRole("button", { name: "Renomear" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(on_rename).toHaveBeenCalledWith(portfolio);
    expect(on_delete).toHaveBeenCalledWith(portfolio);
  });
});

describe("PositionsTable", () => {
  it("renders open and closed positions", () => {
    render(
      <PositionsTable
        positions={[
          build_position_dto(),
          build_position_dto({
            asset: { id: "vale", code: "VALE3", name: "Vale", type: "STOCK", indexer: null, rate: null },
            quantity: 0,
            current_price: null,
            current_value: 0,
            unrealized_result: 0,
            realized_result: -15,
            result_percent: 0,
            price_status: "UNAVAILABLE",
          }),
        ]}
      />,
    );

    const [open_row, closed_row] = screen.getAllByRole("row").slice(1);
    expect(within(open_row).getByText("PETR4")).toBeInTheDocument();
    expect(within(open_row).getByText("R$ 30,00")).toBeInTheDocument();
    expect(within(open_row).getByText("R$ 350,00")).toBeInTheDocument();
    expect(within(open_row).getByText("Mercado")).toBeInTheDocument();
    expect(within(open_row).getByText("+R$ 50,00")).toBeInTheDocument();

    expect(closed_row).toHaveClass("opacity-60");
    expect(within(closed_row).getByText("Encerrada")).toBeInTheDocument();
    expect(within(closed_row).getAllByText("—")).toHaveLength(2);
    expect(within(closed_row).queryByText("Indisponível")).not.toBeInTheDocument();
    expect(within(closed_row).getByText("-R$ 15,00")).toBeInTheDocument();
  });
});

describe("SummaryCards", () => {
  it("renders the four totals", () => {
    render(<SummaryCards totals={build_summary_dto().totals} />);
    expect(screen.getByText("Valor atual")).toBeInTheDocument();
    expect(screen.getByText("R$ 350,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("+R$ 50,00")).toBeInTheDocument();
    expect(screen.getByText("Custo das posições abertas")).toBeInTheDocument();
    expect(screen.getByText("Lucro/prejuízo das vendas")).toBeInTheDocument();
  });
});

describe("PortfolioFormDialog", () => {
  const props = {
    is_open: true,
    initial_name: "",
    is_editing: false,
    is_pending: false,
    error_message: null,
    on_submit: vi.fn(),
    on_close: vi.fn(),
  };

  it("creates a portfolio", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<PortfolioFormDialog {...props} on_submit={on_submit} />);

    expect(screen.getByText("Nova carteira")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome"), "  Longo prazo ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(on_submit).toHaveBeenCalledWith({ name: "Longo prazo" }, expect.anything()));
  });

  it("validates the name", async () => {
    render(<PortfolioFormDialog {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe o nome da carteira")).toBeInTheDocument();
  });

  it("prefills the name when editing and shows errors", () => {
    render(<PortfolioFormDialog {...props} is_editing initial_name="Principal" error_message="Falhou" />);
    expect(screen.getByText("Renomear carteira")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Principal");
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
  });

  it("closes from the cancel button and disables actions while pending", async () => {
    const on_close = vi.fn();
    const { rerender } = render(<PortfolioFormDialog {...props} on_close={on_close} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(on_close).toHaveBeenCalled();

    rerender(<PortfolioFormDialog {...props} is_pending />);
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
  });

  it("closes when the dialog is dismissed with Escape", async () => {
    const on_close = vi.fn();
    render(<PortfolioFormDialog {...props} on_close={on_close} />);
    await userEvent.keyboard("{Escape}");
    expect(on_close).toHaveBeenCalled();
  });
});
