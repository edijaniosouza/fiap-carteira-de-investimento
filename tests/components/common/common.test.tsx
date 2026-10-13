/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/common/confirm_dialog";
import { FormError, FormField } from "@/components/common/form_field";
import { PageHeader } from "@/components/common/page_header";
import { Pagination } from "@/components/common/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/state_views";
import { PriceStatusBadge, SignedValue } from "@/components/common/value_text";

describe("FormField", () => {
  it("links the label to the field and shows the hint", () => {
    render(
      <FormField id="name" label="Nome" hint="Seu nome completo">
        <input id="name" />
      </FormField>,
    );
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByText("Seu nome completo")).toBeInTheDocument();
  });

  it("shows the error instead of the hint", () => {
    render(
      <FormField id="name" label="Nome" hint="Dica" error="Obrigatório">
        <input id="name" />
      </FormField>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Obrigatório");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "name-error");
    expect(screen.queryByText("Dica")).not.toBeInTheDocument();
  });

  it("renders only the field without hint or error", () => {
    const { container } = render(
      <FormField id="name" label="Nome">
        <input id="name" />
      </FormField>,
    );
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });
});

describe("FormError", () => {
  it("renders nothing without message", () => {
    const { container } = render(<FormError message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the message as an alert", () => {
    render(<FormError message="Falhou" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
  });
});

describe("PageHeader", () => {
  it("renders title, description and actions", () => {
    render(<PageHeader title="Carteiras" description="Descrição" actions={<button>Nova</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Carteiras" })).toBeInTheDocument();
    expect(screen.getByText("Descrição")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova" })).toBeInTheDocument();
  });

  it("renders only the title", () => {
    const { container } = render(<PageHeader title="Só título" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("shows the summary and navigates between pages", async () => {
    const user = userEvent.setup();
    const on_page_change = vi.fn();
    render(<Pagination page={2} total_pages={3} total={1234} on_page_change={on_page_change} />);

    expect(screen.getByText("1.234 resultado(s) · página 2 de 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Página anterior" }));
    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(on_page_change.mock.calls).toEqual([[1], [3]]);
  });

  it("disables navigation at the edges", () => {
    render(<Pagination page={1} total_pages={1} total={5} on_page_change={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  });
});

describe("state views", () => {
  it("LoadingState renders the requested skeleton rows", () => {
    render(<LoadingState rows={5} />);
    const container = screen.getByLabelText("Carregando");
    expect(container).toHaveAttribute("aria-busy", "true");
    expect(container.children).toHaveLength(5);
  });

  it("LoadingState defaults to 3 rows", () => {
    render(<LoadingState />);
    expect(screen.getByLabelText("Carregando").children).toHaveLength(3);
  });

  it("ErrorState shows the message and retries", async () => {
    const on_retry = vi.fn();
    render(<ErrorState message="Falhou" on_retry={on_retry} />);
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByText("Falhou")).toBeInTheDocument();
    expect(on_retry).toHaveBeenCalledTimes(1);
  });

  it("ErrorState hides the retry button without handler", () => {
    render(<ErrorState message="Falhou" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("EmptyState renders title, description and action", () => {
    render(<EmptyState title="Vazio" description="Nada aqui" action={<button>Criar</button>} />);
    expect(screen.getByText("Vazio")).toBeInTheDocument();
    expect(screen.getByText("Nada aqui")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeInTheDocument();
  });

  it("EmptyState works with title only", () => {
    render(<EmptyState title="Vazio" />);
    expect(screen.getByText("Vazio")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("SignedValue", () => {
  it("prefixes gains with + and colors them green", () => {
    render(<SignedValue value={10} class_name="extra" />);
    const element = screen.getByText("+R$ 10,00");
    expect(element).toHaveClass("text-emerald-600", "extra");
  });

  it("colors losses as destructive", () => {
    render(<SignedValue value={-0.05} kind="percent" />);
    const element = screen.getByText(/-5,00\s?%/);
    expect(element).toHaveClass("text-destructive");
  });

  it("keeps zero neutral", () => {
    render(<SignedValue value={0} />);
    const element = screen.getByText("R$ 0,00");
    expect(element).not.toHaveClass("text-destructive");
    expect(element).not.toHaveClass("text-emerald-600");
  });
});

describe("PriceStatusBadge", () => {
  it.each([
    ["MARKET", "Mercado", "Cotação de mercado (cache de até 30 min)"],
    ["STALE", "Desatualizada", "Fonte indisponível: exibindo a última cotação salva"],
    ["ESTIMATED", "Estimada", "Valor estimado pela taxa atual do indexador"],
    ["UNAVAILABLE", "Indisponível", "Sem cotação: valor atual considerado igual ao custo"],
  ] as const)("renders %s label and hint", (status, label, hint) => {
    render(<PriceStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveAttribute("title", hint);
  });
});

describe("ConfirmDialog", () => {
  const props = {
    is_open: true,
    title: "Excluir carteira?",
    description: "Tudo será removido.",
    on_confirm: vi.fn(),
    on_cancel: vi.fn(),
  };

  it("renders nothing when closed", () => {
    render(<ConfirmDialog {...props} is_open={false} />);
    expect(screen.queryByText("Excluir carteira?")).not.toBeInTheDocument();
  });

  it("confirms with the default label", async () => {
    const on_confirm = vi.fn();
    render(<ConfirmDialog {...props} on_confirm={on_confirm} />);

    expect(screen.getByText("Tudo será removido.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(on_confirm).toHaveBeenCalledTimes(1);
  });

  it("cancels through the cancel button", async () => {
    const on_cancel = vi.fn();
    render(<ConfirmDialog {...props} confirm_label="Remover" on_cancel={on_cancel} />);

    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(on_cancel).toHaveBeenCalled();
  });

  it("disables both actions while pending", () => {
    render(<ConfirmDialog {...props} is_pending />);
    expect(screen.getByRole("button", { name: "Excluindo..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
