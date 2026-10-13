/** @vitest-environment jsdom */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { build_asset_dto, build_portfolio_dto } from "../support/factories";
import { API_ERROR, query_result, render_with_store } from "../support/render_helpers";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/store/api/catalog_api", () => ({ useGetCatalogQuery: vi.fn() }));
vi.mock("@/store/api/portfolio_api", () => ({ useGetPortfoliosQuery: vi.fn() }));

import { toast } from "sonner";
import { CatalogContainer } from "@/containers/catalog_container";
import { useGetCatalogQuery } from "@/store/api/catalog_api";
import { useGetPortfoliosQuery } from "@/store/api/portfolio_api";

const asset = build_asset_dto();
const page = { items: [asset], page: 1, limit: 20, total: 1, total_pages: 1 };
const plan = { max_portfolios: 1, can_create: false };

function setup({
  catalog = query_result({ data: page }),
  portfolios = [build_portfolio_dto()],
  url_filters = null as Parameters<typeof CatalogContainer>[0]["url_filters"],
} = {}) {
  vi.mocked(useGetCatalogQuery).mockReturnValue(catalog);
  vi.mocked(useGetPortfoliosQuery).mockReturnValue(query_result({ data: { items: portfolios, plan } }));
  return render_with_store(<CatalogContainer url_filters={url_filters} />);
}

describe("CatalogContainer", () => {
  it("queries the variable income group by default", () => {
    setup();
    expect(useGetCatalogQuery).toHaveBeenLastCalledWith({ type: "STOCK,FII,ETF,BDR", q: "", page: 1, limit: 20 });
    expect(screen.getByRole("heading", { name: "Catálogo" })).toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("1 resultado(s) · página 1 de 1")).toBeInTheDocument();
  });

  it("hydrates filters from the URL", async () => {
    const { store } = setup({ url_filters: { group: "FIXED_INCOME", type: "CDB", q: "110", page: 2 } });

    await waitFor(() =>
      expect(useGetCatalogQuery).toHaveBeenLastCalledWith({ type: "CDB", q: "110", page: 2, limit: 20 }),
    );
    expect(store.getState().catalog_filters).toMatchObject({ group: "FIXED_INCOME", type: "CDB", q: "110", page: 2 });
    expect(screen.getByRole("textbox", { name: "Buscar ativos" })).toHaveValue("110");
  });

  it("mirrors filter changes into the URL", async () => {
    const { store } = setup();

    await userEvent.click(screen.getByRole("tab", { name: "Renda fixa" }));

    expect(store.getState().catalog_filters).toMatchObject({ group: "FIXED_INCOME", type: "ALL", page: 1 });
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/catalog?group=FIXED_INCOME&page=1", { scroll: false }),
    );
    expect(useGetCatalogQuery).toHaveBeenLastCalledWith(expect.objectContaining({ type: "TREASURY,CDB" }));
  });

  it("includes type and query in the URL after hydration", async () => {
    setup({ url_filters: { type: "FII", q: "hglg" } });
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/catalog?group=VARIABLE_INCOME&page=1&type=FII&q=hglg", {
        scroll: false,
      }),
    );
  });

  it("changes the type filter", async () => {
    const { store } = setup();
    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar por tipo" }));
    await userEvent.click(await screen.findByRole("option", { name: "FII" }));
    expect(store.getState().catalog_filters.type).toBe("FII");
  });

  it("debounces the search text into the filters", async () => {
    const { store } = setup();
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar ativos" }), " petr ");
    await waitFor(() => expect(store.getState().catalog_filters.q).toBe("petr"));
  });

  it("paginates", async () => {
    const { store } = setup({ catalog: query_result({ data: { ...page, total: 45, total_pages: 3 } }) });
    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(store.getState().catalog_filters.page).toBe(2);
  });

  it("shows loading, empty and error states", async () => {
    const { unmount } = setup({ catalog: query_result({ isLoading: true }) });
    expect(screen.getByLabelText("Carregando")).toBeInTheDocument();
    unmount();

    const empty = setup({ catalog: query_result({ data: { ...page, items: [], total: 0 } }) });
    expect(screen.getByText("Nenhum ativo encontrado")).toBeInTheDocument();
    expect(screen.queryByText(/resultado\(s\)/)).not.toBeInTheDocument();
    empty.unmount();

    const catalog = query_result({ error: API_ERROR });
    setup({ catalog });
    expect(screen.getByText("Mensagem da API")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect((catalog as unknown as { refetch: () => void }).refetch).toHaveBeenCalled();
  });

  it("dims the table while refetching", () => {
    setup({ catalog: query_result({ data: page, isFetching: true }) });
    expect(screen.getByRole("table").closest(".opacity-60")).not.toBeNull();
  });

  it("starts a purchase in the first portfolio", async () => {
    const { store } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Registrar compra" }));

    expect(store.getState().ui.pending_purchase_asset).toEqual({
      id: "asset_1",
      code: "PETR4",
      name: "Petrobras PN",
      type: "STOCK",
      indexer: null,
      rate: null,
    });
    expect(router.push).toHaveBeenCalledWith("/portfolios/portfolio_1/transactions");
  });

  it("asks to create a portfolio before buying", async () => {
    const { store } = setup({ portfolios: [] });

    await userEvent.click(screen.getByRole("button", { name: "Registrar compra" }));

    expect(toast.info).toHaveBeenCalledWith("Crie uma carteira antes de registrar compras.");
    expect(router.push).toHaveBeenCalledWith("/portfolios");
    expect(store.getState().ui.pending_purchase_asset).toBeNull();
  });

  it("sends the asset to the simulator", async () => {
    const { store } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Simular" }));

    expect(store.getState().simulator.asset).toMatchObject({ id: "asset_1", code: "PETR4" });
    expect(router.push).toHaveBeenCalledWith("/simulator");
  });
});
