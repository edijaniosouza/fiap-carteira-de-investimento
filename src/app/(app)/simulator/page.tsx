import type { Metadata } from "next";
import { SimulatorContainer } from "@/containers/simulator_container";

export const metadata: Metadata = { title: "Simulador" };

export default function SimulatorPage() {
  return <SimulatorContainer />;
}
