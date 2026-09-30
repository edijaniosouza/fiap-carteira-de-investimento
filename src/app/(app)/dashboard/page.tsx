import type { Metadata } from "next";
import { DashboardContainer } from "@/containers/dashboard_container";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardContainer />;
}
