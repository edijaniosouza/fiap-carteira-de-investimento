import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AssetSummaryDto } from "@/types/api";

export type SimulatorState = {
  asset: AssetSummaryDto | null;
  amount: number;
  months: number;
};

const initial_state: SimulatorState = {
  asset: null,
  amount: 1000,
  months: 12,
};

export const simulator_slice = createSlice({
  name: "simulator",
  initialState: initial_state,
  reducers: {
    simulation_asset_selected(state, action: PayloadAction<AssetSummaryDto | null>) {
      state.asset = action.payload;
    },
    simulation_params_changed(state, action: PayloadAction<{ amount: number; months: number }>) {
      state.amount = action.payload.amount;
      state.months = action.payload.months;
    },
  },
  selectors: {
    select_simulator: (state) => state,
  },
});

export const { simulation_asset_selected, simulation_params_changed } = simulator_slice.actions;
export const { select_simulator } = simulator_slice.selectors;
