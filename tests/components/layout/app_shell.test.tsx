/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app_shell";

function render_shell(overrides: Partial<Parameters<typeof AppShell>[0]> = {}) {
  const props = {
    user_name: "Maria",
    current_path: "/dashboard",
    is_signing_out: false,
    on_sign_out: vi.fn(),
    children: <p>Conteúdo da página</p>,
    ...overrides,
  };
  render(<AppShell {...props} />);
  return props;
}

describe("AppShell", () => {
  it("renders navigation, greeting and content", () => {
    render_shell();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav.querySelectorAll("a")).toHaveLength(5);
    expect(screen.getByText("Olá, Maria")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo da página")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Minha Carteira" })).toHaveAttribute("href", "/dashboard");
  });

  it("marks the current section, including nested paths", () => {
    render_shell({ current_path: "/portfolios/p1/transactions" });
    expect(screen.getByRole("link", { name: "Carteiras" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("hides the greeting without user name", () => {
    render_shell({ user_name: null });
    expect(screen.queryByText(/Olá/)).not.toBeInTheDocument();
  });

  it("signs out from both buttons", async () => {
    const props = render_shell();
    const buttons = screen.getAllByRole("button", { name: "Sair" });
    expect(buttons).toHaveLength(2);

    for (const button of buttons) {
      await userEvent.click(button);
    }

    expect(props.on_sign_out).toHaveBeenCalledTimes(2);
  });

  it("disables sign out while pending", () => {
    render_shell({ is_signing_out: true });
    expect(screen.getByRole("button", { name: "Saindo..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sair" })).toBeDisabled();
  });
});
