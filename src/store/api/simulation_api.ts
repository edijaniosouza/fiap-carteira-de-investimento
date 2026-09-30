import { base_api } from "@/store/api/base_api";
import type { SimulationDto, SimulationRequest } from "@/types/api";

export const simulation_api = base_api.injectEndpoints({
  endpoints: (build) => ({
    runSimulation: build.mutation<SimulationDto, SimulationRequest>({
      query: (body) => ({ url: "/simulations", method: "POST", body }),
    }),
  }),
});

export const { useRunSimulationMutation } = simulation_api;
