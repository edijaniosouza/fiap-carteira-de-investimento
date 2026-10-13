/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthCard, AuthFooterLink } from "@/components/auth/auth_card";
import { ForgotPasswordForm } from "@/components/auth/forgot_password_form";
import { ResetPasswordForm } from "@/components/auth/reset_password_form";
import { SignInForm } from "@/components/auth/sign_in_form";
import { SignUpForm } from "@/components/auth/sign_up_form";

describe("AuthCard", () => {
  it("renders brand, title, description, content and footer", () => {
    render(
      <AuthCard title="Entrar" description="Acesse sua conta" footer={<span>Rodapé</span>}>
        <p>Conteúdo</p>
      </AuthCard>,
    );
    expect(screen.getByText("Minha Carteira")).toBeInTheDocument();
    expect(screen.getByText("Entrar")).toBeInTheDocument();
    expect(screen.getByText("Acesse sua conta")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
    expect(screen.getByText("Rodapé")).toBeInTheDocument();
  });

  it("omits the footer when not provided", () => {
    render(
      <AuthCard title="Entrar" description="Acesse">
        <p>Conteúdo</p>
      </AuthCard>,
    );
    expect(screen.queryByText("Rodapé")).not.toBeInTheDocument();
  });
});

describe("AuthFooterLink", () => {
  it("renders prompt and link", () => {
    render(<AuthFooterLink prompt="Não tem conta?" href="/sign_up" label="Cadastre-se" />);
    expect(screen.getByText(/Não tem conta\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastre-se" })).toHaveAttribute("href", "/sign_up");
  });

  it("renders only the link without prompt", () => {
    const { container } = render(<AuthFooterLink href="/sign_in" label="Voltar" />);
    expect(container.textContent).toBe("Voltar");
  });
});

describe("SignInForm", () => {
  it("validates required fields", async () => {
    const on_submit = vi.fn();
    render(<SignInForm is_submitting={false} error_message={null} on_submit={on_submit} />);

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("E-mail inválido")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha")).toBeInTheDocument();
    expect(on_submit).not.toHaveBeenCalled();
  });

  it("submits normalized values", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<SignInForm is_submitting={false} error_message={null} on_submit={on_submit} />);

    await user.type(screen.getByLabelText("E-mail"), "Maria@Example.com");
    await user.type(screen.getByLabelText("Senha"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(on_submit).toHaveBeenCalledWith({ email: "maria@example.com", password: "secret" }, expect.anything()),
    );
  });

  it("shows server errors, the forgot password link and the pending state", () => {
    render(<SignInForm is_submitting error_message="E-mail ou senha inválidos" on_submit={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha inválidos");
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/forgot_password");
    expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled();
  });
});

describe("SignUpForm", () => {
  it("validates and shows the password hint", async () => {
    render(<SignUpForm is_submitting={false} error_message={null} on_submit={vi.fn()} />);
    expect(screen.getByText("Mínimo de 8 caracteres")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Informe ao menos 2 caracteres")).toBeInTheDocument();
    expect(screen.getByText("A senha deve ter ao menos 8 caracteres")).toBeInTheDocument();
  });

  it("submits valid values", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<SignUpForm is_submitting={false} error_message={null} on_submit={on_submit} />);

    await user.type(screen.getByLabelText("Nome"), "Maria");
    await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await user.type(screen.getByLabelText("Senha"), "12345678");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() =>
      expect(on_submit).toHaveBeenCalledWith(
        { name: "Maria", email: "maria@example.com", password: "12345678" },
        expect.anything(),
      ),
    );
  });

  it("shows the pending state and errors", () => {
    render(<SignUpForm is_submitting error_message="E-mail em uso" on_submit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Criando conta..." })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("E-mail em uso");
  });
});

describe("ForgotPasswordForm", () => {
  it("submits the e-mail", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<ForgotPasswordForm is_submitting={false} error_message={null} success_message={null} on_submit={on_submit} />);

    await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    await waitFor(() => expect(on_submit).toHaveBeenCalledWith({ email: "maria@example.com" }, expect.anything()));
  });

  it("validates the e-mail", async () => {
    render(<ForgotPasswordForm is_submitting={false} error_message={null} success_message={null} on_submit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));
    expect(await screen.findByText("E-mail inválido")).toBeInTheDocument();
  });

  it("replaces the form by the success message", () => {
    render(<ForgotPasswordForm is_submitting={false} error_message={null} success_message="Link enviado" on_submit={vi.fn()} />);
    expect(screen.getByText("Link enviado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows pending state and errors", () => {
    render(<ForgotPasswordForm is_submitting error_message="Falhou" success_message={null} on_submit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Enviando..." })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
  });
});

describe("ResetPasswordForm", () => {
  it("requires matching passwords", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<ResetPasswordForm is_submitting={false} error_message={null} on_submit={on_submit} />);

    await user.type(screen.getByLabelText("Nova senha"), "12345678");
    await user.type(screen.getByLabelText("Confirme a nova senha"), "87654321");
    await user.click(screen.getByRole("button", { name: "Redefinir senha" }));

    expect(await screen.findByText("As senhas não conferem")).toBeInTheDocument();
    expect(on_submit).not.toHaveBeenCalled();
  });

  it("submits matching passwords", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<ResetPasswordForm is_submitting={false} error_message={null} on_submit={on_submit} />);

    await user.type(screen.getByLabelText("Nova senha"), "12345678");
    await user.type(screen.getByLabelText("Confirme a nova senha"), "12345678");
    await user.click(screen.getByRole("button", { name: "Redefinir senha" }));

    await waitFor(() =>
      expect(on_submit).toHaveBeenCalledWith(
        { password: "12345678", password_confirmation: "12345678" },
        expect.anything(),
      ),
    );
  });

  it("shows pending state and errors", () => {
    render(<ResetPasswordForm is_submitting error_message="Token expirado" on_submit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Token expirado");
  });
});
