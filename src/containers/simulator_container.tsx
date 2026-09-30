"use client";

import { useState } from "react";
import { PageHeader } from "@/components/common/page_header";
import { EmptyState } from "@/components/common/state_views";
import { SimulationResult } from "@/components/simulator/simulation_result";
import { SimulatorForm, type SimulatorFormValues } from "@/components/simulator/simulator_form";
import { AssetPickerContainer } from "@/containers/asset_picker_container";
import { get_error_message } from "@/store/api/base_api";
import { useRunSimulationMutation } from "@/store/api/simulation_api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  select_simulator,
  simulation_asset_selected,
  simulation_params_changed,
} from "@/store/slices/simulator_slice";

export function SimulatorContainer() {
  const dispatch = useAppDispatch();
  const simulator = useAppSelector(select_simulator);
  const [asset_error, set_asset_error] = useState<string | null>(null);
  // fixedCacheKey keeps the last result in the store while navigating between pages.
  const [run_simulation, { data: result, isLoading: is_loading, error }] = useRunSimulationMutation({
    fixedCacheKey: "simulator",
  });

  const handle_submit = async (values: SimulatorFormValues) => {
    if (!simulator.asset) {
      set_asset_error("Selecione um ativo");
      return;
    }
    dispatch(simulation_params_changed(values));
    try {
      await run_simulation({ asset_id: simulator.asset.id, ...values }).unwrap();
    } catch {
      // Error message is rendered from the mutation state.
    }
  };

  return (
    <>
      <PageHeader
        title="Simulador"
        description="Projete um investimento com base na taxa ou cotação atual"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SimulatorForm
          default_values={{ amount: simulator.amount, months: simulator.months }}
          asset_error={asset_error}
          error_message={error ? get_error_message(error) : null}
          is_pending={is_loading}
          on_submit={handle_submit}
          asset_picker={
            <AssetPickerContainer
              id="asset_search"
              selected_asset={simulator.asset}
              on_select={(asset) => {
                set_asset_error(null);
                dispatch(simulation_asset_selected(asset));
              }}
            />
          }
        />
        {result ? (
          <SimulationResult result={result} />
        ) : (
          <EmptyState
            title="Nenhuma simulação ainda"
            description="Escolha um ativo, valor e prazo para ver a projeção."
          />
        )}
      </div>
    </>
  );
}
