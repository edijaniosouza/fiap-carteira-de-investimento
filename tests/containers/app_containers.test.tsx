/** @vitest-environment jsdom */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  build_asset_summary_dto,
  build_portfolio_dto,
  build_position_dto,
  build_summary_dto,
  build_user_dto,
} from "../support/factories";
import { API_ERROR, mutation_result, query_result, render_with_store } from "../support/render_helpers";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/portfolios/p1" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/store/api/auth_api", () => ({
  useSignOutMutation: vi.fn(),
  useGetProfileQuery: vi.fn(),
  useUpdateProfileMutation: vi.fn(),
}));
vi.mock("@/store/api/portfolio_api", () => ({
  useGetPortfoliosQuery: vi.fn(),
  useGetPortfolioSummaryQuery: vi.fn(),
}));
vi.mock("@/store/api/catalog_api", () => ({ useGetCatalogQuery: vi.fn() }));
vi.mock("@/store/api/simulation_api", () => ({ useRunSimulationMutation: vi.fn() }));

import { toast } from "sonner";
import { AppShellContainer } from "@/containers/app_shell_container";
import { AssetPickerContainer } from "@/containers/asset_picker_container";
import { DashboardContainer } from "@/containers/dashboard_container";
import { PortfolioDetailContainer } from "@/containers/portfolio_detail_container";
import { ProfileContainer } from "@/containers/profile_container";
import { SimulatorContainer } from "@/containers/simulator_container";
import { useGetProfileQuery, useSignOutMutation, useUpdateProfileMutation } from "@/store/api/auth_api";
import { useGetCatalogQuery } from "@/store/api/catalog_api";
import { useGetPortfolioSummaryQuery, useGetPortfoliosQuery } from "@/store/api/portfolio_api";
import { useRunSimulationMutation } from "@/store/api/simulation_api";
import type { FixedIncomeSimulationDto } from "@/types/api";

const user_dto = build_user_dto();
const asset = build_asset_summary_dto();

describe("AppShellContainer", () => {
  it("shows the user and marks the current path", () => {
    vi.mocked(useSignOutMutation).mockReturnValue(mutation_result().tuple);
    render_with_store(
      <AppShellContainer>
        <p>Página</p>
      </AppShellContainer>,
      { session: { current_user: user_dto } },
    );

    expect(screen.getByText("Olá, Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Página")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Carteiras" })).toHaveAttribute("aria-current", "page");
  });

  it("signs out, clears client state and goes to sign in", async () => {
    const mutation = mutation_result();
    vi.mocked(useSignOutMutation).mockReturnValue(mutation.tuple);
    const { store } = render_with_store(<AppShellContainer>{null}</AppShellContainer>, {
      session: { current_user: user_dto },
    });

    await userEvent.click(screen.getAllByRole("button", { name: "Sair" })[0]);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sign_in"));
    expect(mutation.trigger).toHaveBeenCalled();
    expect(store.getState().session.current_user).toBeNull();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows the pending sign out state", () => {
    vi.mocked(useSignOutMutation).mockReturnValue(mutation_result({ isLoading: true }).tuple);
    render_with_store(<AppShellContainer>{null}</AppShellContainer>);
    expect(screen.getByRole("button", { name: "Saindo..." })).toBeDisabled();
    expect(screen.queryByText(/Olá/)).not.toBeInTheDocument();
  });
});

describe("AssetPickerContainer", () => {
  const options = [asset, build_asset_summary_dto({ id: "a2", code: "VALE3", name: "Vale" })];

  it("searches investable assets with debounce and selects one", async () => {
    const user = userEvent.setup();
    const on_select = vi.fn();
    vi.mocked(useGetCatalogQuery).mockReturnValue(query_result({ data: { items: options } }));
    render_with_store(<AssetPickerContainer id="asset_search" selected_asset={null} on_select={on_select} />);

    expect(useGetCatalogQuery).toHaveBeenLastCalledWith(
      { type: "STOCK,FII,ETF,BDR,TREASURY,CDB", q: "", page: 1, limit: 8 },
      { skip: false },
    );

    const input = screen.getByPlaceholderText("Digite o código ou nome do ativo");
    await user.type(input, " va ");
    await waitFor(() =>
      expect(useGetCatalogQuery).toHaveBeenLastCalledWith(expect.objectContaining({ q: "va" }), { skip: false }),
    );

    await user.click(screen.getByText("VALE3"));
    expect(on_select).toHaveBeenCalledWith(options[1]);
    expect(input).toHaveValue("");
  });

  it("shows the searching state", () => {
    vi.mocked(useGetCatalogQuery).mockReturnValue(query_result({ isFetching: true }));
    render_with_store(<AssetPickerContainer id="asset_search" selected_asset={null} on_select={vi.fn()} />);
    expect(screen.getByText("Buscando...")).toBeInTheDocument();
  });

  it("skips the search while an asset is selected", () => {
    vi.mocked(useGetCatalogQuery).mockReturnValue(query_result());
    render_with_store(<AssetPickerContainer id="asset_search" selected_asset={asset} on_select={vi.fn()} />);
    expect(useGetCatalogQuery).toHaveBeenLastCalledWith(expect.anything(), { skip: true });
    expect(screen.getByText("PETR4")).toBeInTheDocument();
  });
});

describe("DashboardContainer", () => {
  const portfolios = { items: [build_portfolio_dto()], plan: { max_portfolios: 1, can_create: false } };

  it("shows loading while queries load, greeting by first name", () => {
    vi.mocked(useGetPortfoliosQuery).mockReturnValue(query_result({ isLoading: true }));
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result());
    render_with_store(<DashboardContainer />, { session: { current_user: user_dto } });

    expect(screen.getByRole("heading", { name: "Olá, Maria" })).toBeInTheDocument();
    expect(screen.getByLabelText("Carregando")).toBeInTheDocument();
    expect(useGetPortfolioSummaryQuery).toHaveBeenCalledWith("", { skip: true });
  });

  it("shows errors with retry", async () => {
    const portfolios_query = query_result({ error: API_ERROR });
    vi.mocked(useGetPortfoliosQuery).mockReturnValue(portfolios_query);
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result());
    render_with_store(<DashboardContainer />);

    expect(screen.getByText("Mensagem da API")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect((portfolios_query as unknown as { refetch: () => void }).refetch).toHaveBeenCalled();
  });

  it("invites to create the first portfolio", () => {
    vi.mocked(useGetPortfoliosQuery).mockReturnValue(query_result({ data: { items: [], plan: portfolios.plan } }));
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result());
    render_with_store(<DashboardContainer />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Crie sua primeira carteira")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criar carteira/ })).toHaveAttribute("href", "/portfolios");
  });

  it("shows the summary with at most five open positions", () => {
    const positions = [
      ...Array.from({ length: 6 }, (_, index) =>
        build_position_dto({ asset: build_asset_summary_dto({ id: `a${index}`, code: `ATIVO${index}` }) }),
      ),
      build_position_dto({ asset: build_asset_summary_dto({ id: "closed", code: "FECHADO" }), quantity: 0 }),
    ];
    vi.mocked(useGetPortfoliosQuery).mockReturnValue(query_result({ data: portfolios }));
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result({ data: build_summary_dto({ positions }) }));
    render_with_store(<DashboardContainer />);

    expect(useGetPortfolioSummaryQuery).toHaveBeenCalledWith("portfolio_1", { skip: false });
    expect(screen.getByText("Resumo da carteira Principal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Visão completa/ })).toHaveAttribute("href", "/portfolios/portfolio_1");
    expect(screen.getByText("Alocação por tipo")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(6);
    expect(screen.queryByText("ATIVO5")).not.toBeInTheDocument();
    expect(screen.queryByText("FECHADO")).not.toBeInTheDocument();
  });

  it("invites to the catalog when there are no open positions", () => {
    vi.mocked(useGetPortfoliosQuery).mockReturnValue(query_result({ data: portfolios }));
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(
      query_result({ data: build_summary_dto({ positions: [], allocation_by_type: [] }) }),
    );
    render_with_store(<DashboardContainer />);

    expect(screen.getByText("Nenhuma posição aberta")).toBeInTheDocument();
    expect(screen.queryByText("Alocação por tipo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para o catálogo" })).toHaveAttribute("href", "/catalog");
  });

  it("handles a missing summary while it is not loaded", () => {
    vi.mocked(useGetPortfoliosQuery).mockReturnValue(query_result({ data: portfolios }));
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result());
    render_with_store(<DashboardContainer />);
    expect(screen.queryByText("Valor atual")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma posição aberta")).toBeInTheDocument();
  });
});

describe("PortfolioDetailContainer", () => {
  it("shows loading", () => {
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result({ isLoading: true }));
    render_with_store(<PortfolioDetailContainer portfolio_id="portfolio_1" />);
    expect(screen.getByLabelText("Carregando")).toBeInTheDocument();
    expect(useGetPortfolioSummaryQuery).toHaveBeenCalledWith("portfolio_1");
  });

  it("shows the API error or a fallback", () => {
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result({ error: API_ERROR }));
    const { unmount } = render_with_store(<PortfolioDetailContainer portfolio_id="portfolio_1" />);
    expect(screen.getByText("Mensagem da API")).toBeInTheDocument();
    unmount();

    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result());
    render_with_store(<PortfolioDetailContainer portfolio_id="portfolio_1" />);
    expect(screen.getByText("Não foi possível carregar a carteira.")).toBeInTheDocument();
  });

  it("shows the empty state with a link to transactions", () => {
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result({ data: build_summary_dto({ positions: [] }) }));
    render_with_store(<PortfolioDetailContainer portfolio_id="portfolio_1" />);

    expect(screen.getByRole("heading", { name: "Principal" })).toBeInTheDocument();
    expect(screen.getByText("Carteira sem posições")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: /Transações/ })) {
      expect(button).toHaveAttribute("href", "/portfolios/portfolio_1/transactions");
    }
  });

  it("shows allocation and positions", () => {
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(query_result({ data: build_summary_dto() }));
    render_with_store(<PortfolioDetailContainer portfolio_id="portfolio_1" />);
    expect(screen.getByText("Alocação por tipo")).toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
  });

  it("hides the allocation chart when it is empty", () => {
    vi.mocked(useGetPortfolioSummaryQuery).mockReturnValue(
      query_result({ data: build_summary_dto({ allocation_by_type: [] }) }),
    );
    render_with_store(<PortfolioDetailContainer portfolio_id="portfolio_1" />);
    expect(screen.queryByText("Alocação por tipo")).not.toBeInTheDocument();
    expect(screen.getByText("PETR4")).toBeInTheDocument();
  });
});

describe("ProfileContainer", () => {
  function mock_mutations(profile = mutation_result(), password = mutation_result()) {
    vi.mocked(useUpdateProfileMutation).mockImplementation(((options: { fixedCacheKey: string }) =>
      options.fixedCacheKey === "profile_data" ? profile.tuple : password.tuple) as never);
    return { profile, password };
  }

  it("shows loading and errors", () => {
    mock_mutations();
    vi.mocked(useGetProfileQuery).mockReturnValue(query_result({ isLoading: true }));
    const { unmount } = render_with_store(<ProfileContainer />);
    expect(screen.getByLabelText("Carregando")).toBeInTheDocument();
    unmount();

    vi.mocked(useGetProfileQuery).mockReturnValue(query_result({ error: API_ERROR }));
    render_with_store(<ProfileContainer />);
    expect(screen.getByText("Mensagem da API")).toBeInTheDocument();
  });

  it("updates the profile and the session", async () => {
    const user = userEvent.setup();
    const { profile } = mock_mutations();
    profile.unwrap.mockResolvedValue({ ...user_dto, name: "Maria Souza" });
    vi.mocked(useGetProfileQuery).mockReturnValue(query_result({ data: user_dto }));
    const { store } = render_with_store(<ProfileContainer />, { session: { current_user: user_dto } });

    const name_input = screen.getByLabelText("Nome");
    await user.clear(name_input);
    await user.type(name_input, "Maria Souza");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Perfil atualizado"));
    expect(profile.trigger).toHaveBeenCalledWith({
      name: "Maria Souza",
      email: "maria@example.com",
      current_password: undefined,
    });
    expect(store.getState().session.current_user?.name).toBe("Maria Souza");
  });

  it("keeps the session when the profile update fails", async () => {
    const user = userEvent.setup();
    const { profile } = mock_mutations();
    profile.unwrap.mockRejectedValue(API_ERROR);
    vi.mocked(useGetProfileQuery).mockReturnValue(query_result({ data: user_dto }));
    const { store } = render_with_store(<ProfileContainer />, { session: { current_user: user_dto } });

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(profile.unwrap).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(store.getState().session.current_user).toEqual(user_dto);
  });

  async function change_password(user: ReturnType<typeof userEvent.setup>) {
    const password_card = screen.getByText("Alterar senha", { selector: "[data-slot=card-title]" }).closest(
      "[data-slot=card]",
    ) as HTMLElement;
    await user.type(within(password_card).getByLabelText("Senha atual"), "old_password");
    await user.type(within(password_card).getByLabelText("Nova senha"), "12345678");
    await user.type(within(password_card).getByLabelText("Confirme a nova senha"), "12345678");
    await user.click(within(password_card).getByRole("button", { name: "Alterar senha" }));
  }

  it("changes the password", async () => {
    const user = userEvent.setup();
    const { password } = mock_mutations();
    vi.mocked(useGetProfileQuery).mockReturnValue(query_result({ data: user_dto }));
    render_with_store(<ProfileContainer />);

    await change_password(user);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Senha alterada"));
    expect(password.trigger).toHaveBeenCalledWith({ current_password: "old_password", new_password: "12345678" });
  });

  it("reports password errors from the mutation state", async () => {
    const user = userEvent.setup();
    const { password } = mock_mutations(mutation_result(), mutation_result({ error: API_ERROR }));
    password.unwrap.mockRejectedValue(API_ERROR);
    vi.mocked(useGetProfileQuery).mockReturnValue(query_result({ data: user_dto }));
    render_with_store(<ProfileContainer />);

    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem da API");
    await change_password(user);

    await waitFor(() => expect(password.unwrap).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("SimulatorContainer", () => {
  const result: FixedIncomeSimulationDto = {
    kind: "FIXED_INCOME",
    asset: build_asset_summary_dto({ code: "CDB_PRE", type: "CDB", indexer: "PRE", rate: 12 }),
    amount: 1000,
    months: 12,
    annual_rate: 0.12,
    reference_index: null,
    gross_value: 1120,
    earnings: 120,
    income_tax_rate: 0.2,
    income_tax: 24,
    net_value: 1096,
    monthly_series: [{ month: 0, value: 1000 }],
  };

  it("requires an asset before simulating", async () => {
    const mutation = mutation_result();
    vi.mocked(useRunSimulationMutation).mockReturnValue(mutation.tuple);
    vi.mocked(useGetCatalogQuery).mockReturnValue(query_result({ data: { items: [asset] } }));
    render_with_store(<SimulatorContainer />);

    expect(screen.getByText("Nenhuma simulação ainda")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Simular" }));

    expect(await screen.findByText("Selecione um ativo")).toBeInTheDocument();
    expect(mutation.trigger).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText("PETR4"));
    expect(screen.queryByText("Selecione um ativo")).not.toBeInTheDocument();
  });

  it("runs the simulation with the selected asset and remembers params", async () => {
    const user = userEvent.setup();
    const mutation = mutation_result();
    vi.mocked(useRunSimulationMutation).mockReturnValue(mutation.tuple);
    vi.mocked(useGetCatalogQuery).mockReturnValue(query_result());
    const { store } = render_with_store(<SimulatorContainer />, {
      simulator: { asset, amount: 1000, months: 12 },
    });

    await user.clear(screen.getByLabelText("Valor a investir (R$)"));
    await user.type(screen.getByLabelText("Valor a investir (R$)"), "5000");
    await user.click(screen.getByRole("button", { name: "Simular" }));

    await waitFor(() =>
      expect(mutation.trigger).toHaveBeenCalledWith({ asset_id: "asset_1", amount: 5000, months: 12 }),
    );
    expect(useRunSimulationMutation).toHaveBeenCalledWith({ fixedCacheKey: "simulator" });
    expect(store.getState().simulator).toMatchObject({ amount: 5000, months: 12 });
  });

  it("swallows simulation errors and renders them from the state", async () => {
    const mutation = mutation_result({ error: API_ERROR });
    mutation.unwrap.mockRejectedValue(API_ERROR);
    vi.mocked(useRunSimulationMutation).mockReturnValue(mutation.tuple);
    vi.mocked(useGetCatalogQuery).mockReturnValue(query_result());
    render_with_store(<SimulatorContainer />, { simulator: { asset, amount: 1000, months: 12 } });

    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem da API");
    await userEvent.click(screen.getByRole("button", { name: "Simular" }));
    await waitFor(() => expect(mutation.unwrap).toHaveBeenCalled());
  });

  it("renders the last result", () => {
    vi.mocked(useRunSimulationMutation).mockReturnValue(mutation_result({ data: result }).tuple);
    vi.mocked(useGetCatalogQuery).mockReturnValue(query_result());
    render_with_store(<SimulatorContainer />);
    expect(screen.getByText("CDB_PRE · R$ 1.000,00 por 12 meses")).toBeInTheDocument();
  });

  it("clears the selected asset", async () => {
    vi.mocked(useRunSimulationMutation).mockReturnValue(mutation_result().tuple);
    vi.mocked(useGetCatalogQuery).mockReturnValue(query_result());
    const { store } = render_with_store(<SimulatorContainer />, { simulator: { asset, amount: 1000, months: 12 } });

    await userEvent.click(screen.getByRole("button", { name: "Trocar ativo" }));

    expect(store.getState().simulator.asset).toBeNull();
  });
});
