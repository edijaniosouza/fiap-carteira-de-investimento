/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { build_asset_dto } from "../../support/factories";
import { CatalogTable } from "@/components/catalog/catalog_table";
import { CatalogToolbar, type CatalogToolbarProps } from "@/components/catalog/catalog_toolbar";

describe("CatalogTable", () => {
  const stock = build_asset_dto();
  const treasury = build_asset_dto({
    id: "t1",
    code: "TESOURO_IPCA_2035",
    name: "Tesouro IPCA+ 2035",
    type: "TREASURY",
    indexer: "IPCA",
    rate: 6.5,
    maturity_date: "2035-05-15",
    last_price: null,
  });
  const cdb = build_asset_dto({
    id: "c1",
    code: "CDB_110",
    name: "CDB 110% CDI",
    type: "CDB",
    indexer: "CDI",
    rate: 110,
    maturity_date: null,
  });

  it("describes price for variable income and rate for fixed income", () => {
    render(<CatalogTable assets={[stock, treasury, cdb]} on_buy={vi.fn()} on_simulate={vi.fn()} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("PETR4")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Ação")).toBeInTheDocument();
    expect(within(rows[0]).getByText("R$ 35,50")).toBeInTheDocument();
    expect(within(rows[0]).getByTitle("Petrobras PN")).toBeInTheDocument();
    expect(within(rows[1]).getByText("IPCA + 6,5% a.a. · vence 15/05/2035")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Tesouro Direto")).toBeInTheDocument();
    expect(within(rows[2]).getByText("110% CDI")).toBeInTheDocument();
  });

  it("calls buy and simulate with the asset", async () => {
    const user = userEvent.setup();
    const on_buy = vi.fn();
    const on_simulate = vi.fn();
    render(<CatalogTable assets={[stock]} on_buy={on_buy} on_simulate={on_simulate} />);

    await user.click(screen.getByRole("button", { name: "Simular" }));
    await user.click(screen.getByRole("button", { name: "Registrar compra" }));

    expect(on_simulate).toHaveBeenCalledWith(stock);
    expect(on_buy).toHaveBeenCalledWith(stock);
  });
});

describe("CatalogToolbar", () => {
  function render_toolbar(overrides: Partial<CatalogToolbarProps> = {}) {
    const props: CatalogToolbarProps = {
      group: "VARIABLE_INCOME",
      type: "ALL",
      search_text: "",
      on_group_change: vi.fn(),
      on_type_change: vi.fn(),
      on_search_change: vi.fn(),
      ...overrides,
    };
    render(<CatalogToolbar {...props} />);
    return props;
  }

  it("changes the group through the tabs", async () => {
    const props = render_toolbar();
    expect(screen.getByRole("tab", { name: "Renda variável" })).toHaveAttribute("aria-selected", "true");

    await userEvent.click(screen.getByRole("tab", { name: "Renda fixa" }));

    expect(props.on_group_change).toHaveBeenCalledWith("FIXED_INCOME");
  });

  it("reports search changes", async () => {
    const props = render_toolbar({ search_text: "PE" });
    const input = screen.getByRole("textbox", { name: "Buscar ativos" });
    expect(input).toHaveValue("PE");

    await userEvent.type(input, "T");

    expect(props.on_search_change).toHaveBeenCalledWith("PET");
  });

  it("shows the selected type and offers only the group types", async () => {
    const props = render_toolbar({ group: "FIXED_INCOME", type: "CDB" });
    const trigger = screen.getByRole("combobox", { name: "Filtrar por tipo" });
    expect(trigger).toHaveTextContent("CDB");

    await userEvent.click(trigger);
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Todos os tipos", "Tesouro Direto", "CDB"]);

    await userEvent.click(screen.getByRole("option", { name: "Tesouro Direto" }));
    expect(props.on_type_change).toHaveBeenCalledWith("TREASURY");
  });

  it("lists variable income types", async () => {
    render_toolbar();
    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar por tipo" }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Todos os tipos", "Ação", "FII", "ETF", "BDR"]);
  });
});
