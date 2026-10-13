/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { build_asset_summary_dto } from "../../support/factories";
import { SimulationResult } from "@/components/simulator/simulation_result";
import { SimulatorForm } from "@/components/simulator/simulator_form";
import type { FixedIncomeSimulationDto, VariableIncomeSimulationDto } from "@/types/api";

const fixed_income_result: FixedIncomeSimulationDto = {
  kind: "FIXED_INCOME",
  asset: build_asset_summary_dto({ code: "CDB_110", name: "CDB 110% CDI", type: "CDB", indexer: "CDI", rate: 110 }),
  amount: 1000,
  months: 12,
  annual_rate: 0.1639,
  reference_index: { code: "CDI", annual_rate: 14.9 },
  gross_value: 1163.9,
  earnings: 163.9,
  income_tax_rate: 0.2,
  income_tax: 32.78,
  net_value: 1131.12,
  monthly_series: [
    { month: 0, value: 1000 },
    { month: 12, value: 1163.9 },
  ],
};

const variable_income_result: VariableIncomeSimulationDto = {
  kind: "VARIABLE_INCOME",
  asset: build_asset_summary_dto(),
  amount: 1000,
  months: 12,
  current_price: 30,
  price_status: "STALE",
  share_quantity: 33,
  invested_amount: 990,
  leftover: 10,
  scenarios: [
    { name: "PESSIMISTIC", annual_return: -0.1, final_value: 901, result: -99 },
    { name: "BASE", annual_return: 0.08, final_value: 1079.2, result: 79.2 },
    { name: "OPTIMISTIC", annual_return: 0.2, final_value: 1198, result: 198 },
  ],
  monthly_series: [{ month: 0, pessimistic: 1000, base: 1000, optimistic: 1000 }],
};

describe("SimulationResult", () => {
  it("renders the fixed income breakdown", () => {
    render(<SimulationResult result={fixed_income_result} />);

    expect(screen.getByText("CDB_110 · R$ 1.000,00 por 12 meses")).toBeInTheDocument();
    expect(screen.getByText("CDB 110% CDI")).toBeInTheDocument();
    expect(screen.getByText("110% CDI")).toBeInTheDocument();
    expect(screen.getByText("CDI atual")).toBeInTheDocument();
    expect(screen.getByText("14,9% a.a.")).toBeInTheDocument();
    expect(screen.getByText(/16,39\s?% a\.a\./)).toBeInTheDocument();
    expect(screen.getByText("R$ 1.163,90")).toBeInTheDocument();
    expect(screen.getByText("+R$ 163,90")).toBeInTheDocument();
    expect(screen.getByText(/IR \(20,00\s?%\)/)).toBeInTheDocument();
    expect(screen.getByText("-R$ 32,78")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.131,12")).toBeInTheDocument();
  });

  it("omits the reference index when absent", () => {
    render(<SimulationResult result={{ ...fixed_income_result, reference_index: null }} />);
    expect(screen.queryByText("CDI atual")).not.toBeInTheDocument();
  });

  it("renders the variable income scenarios", () => {
    render(<SimulationResult result={variable_income_result} />);

    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByText("Desatualizada")).toBeInTheDocument();
    expect(screen.getByText("33")).toBeInTheDocument();
    expect(screen.getByText("R$ 990,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 10,00")).toBeInTheDocument();
    expect(screen.getByText(/Pessimista \(-10,00\s?% a\.a\.\)/)).toBeInTheDocument();
    expect(screen.getByText(/Base \(8,00\s?% a\.a\.\)/)).toBeInTheDocument();
    expect(screen.getByText(/Otimista \(20,00\s?% a\.a\.\)/)).toBeInTheDocument();
    expect(screen.getByText("-R$ 99,00")).toBeInTheDocument();
    expect(screen.getByText(/não representam recomendação/)).toBeInTheDocument();
  });
});

describe("SimulatorForm", () => {
  const props = {
    default_values: { amount: 1000, months: 12 },
    asset_picker: <input id="asset_search" />,
    asset_error: null,
    error_message: null,
    is_pending: false,
    on_submit: vi.fn(),
  };

  it("submits coerced numbers", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<SimulatorForm {...props} on_submit={on_submit} />);

    expect(screen.getByLabelText("Valor a investir (R$)")).toHaveValue(1000);
    await user.clear(screen.getByLabelText("Prazo (meses)"));
    await user.type(screen.getByLabelText("Prazo (meses)"), "24");
    await user.click(screen.getByRole("button", { name: "Simular" }));

    await waitFor(() => expect(on_submit).toHaveBeenCalledWith({ amount: 1000, months: 24 }, expect.anything()));
  });

  it("validates ranges", async () => {
    const user = userEvent.setup();
    render(<SimulatorForm {...props} />);

    await user.clear(screen.getByLabelText("Valor a investir (R$)"));
    await user.type(screen.getByLabelText("Valor a investir (R$)"), "0");
    await user.clear(screen.getByLabelText("Prazo (meses)"));
    await user.type(screen.getByLabelText("Prazo (meses)"), "601");
    await user.click(screen.getByRole("button", { name: "Simular" }));

    expect(await screen.findByText("O valor deve ser maior que zero")).toBeInTheDocument();
    expect(screen.getByText("Prazo máximo de 600 meses")).toBeInTheDocument();
  });

  it("renders the asset picker slot, asset error, server error and pending state", () => {
    render(<SimulatorForm {...props} asset_error="Selecione um ativo" error_message="Cotação indisponível" is_pending />);
    expect(screen.getByLabelText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Selecione um ativo")).toBeInTheDocument();
    expect(screen.getByText("Cotação indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulando..." })).toBeDisabled();
  });
});
