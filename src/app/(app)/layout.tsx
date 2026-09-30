import type { ReactNode } from "react";
import { AppShellContainer } from "@/containers/app_shell_container";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShellContainer>{children}</AppShellContainer>;
}
