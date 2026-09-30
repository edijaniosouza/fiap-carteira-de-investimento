import type { ReactNode } from "react";
import Link from "next/link";
import {
  BriefcaseIcon,
  CalculatorIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SearchIcon,
  UserIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/catalog", label: "Catálogo", icon: SearchIcon },
  { href: "/portfolios", label: "Carteiras", icon: BriefcaseIcon },
  { href: "/simulator", label: "Simulador", icon: CalculatorIcon },
  { href: "/profile", label: "Perfil", icon: UserIcon },
] as const;

type AppShellProps = {
  user_name: string | null;
  current_path: string;
  is_signing_out: boolean;
  on_sign_out: () => void;
  children: ReactNode;
};

export function AppShell({ user_name, current_path, is_signing_out, on_sign_out, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="border-b bg-muted/30 md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-4 md:flex-col md:items-stretch">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <WalletIcon className="size-5" />
            Minha Carteira
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            disabled={is_signing_out}
            onClick={on_sign_out}
          >
            <LogOutIcon /> Sair
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0" aria-label="Principal">
          {NAV_ITEMS.map((item) => {
            const is_active = current_path === item.href || current_path.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={is_active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  is_active && "bg-muted font-medium text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden space-y-2 px-4 py-4 md:block">
          {user_name && <p className="truncate text-sm text-muted-foreground">Olá, {user_name}</p>}
          <Button variant="outline" size="sm" className="w-full" disabled={is_signing_out} onClick={on_sign_out}>
            <LogOutIcon /> {is_signing_out ? "Saindo..." : "Sair"}
          </Button>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  );
}
