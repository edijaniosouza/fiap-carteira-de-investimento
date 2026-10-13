/** @vitest-environment jsdom */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { build_user_dto } from "../support/factories";
import { API_ERROR, mutation_result, render_with_store } from "../support/render_helpers";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/store/api/auth_api", () => ({
  useSignInMutation: vi.fn(),
  useSignUpMutation: vi.fn(),
  useForgotPasswordMutation: vi.fn(),
  useResetPasswordMutation: vi.fn(),
}));

import { toast } from "sonner";
import { ForgotPasswordContainer } from "@/containers/auth/forgot_password_container";
import { ResetPasswordContainer } from "@/containers/auth/reset_password_container";
import { SignInContainer } from "@/containers/auth/sign_in_container";
import { SignUpContainer } from "@/containers/auth/sign_up_container";
import {
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useSignInMutation,
  useSignUpMutation,
} from "@/store/api/auth_api";

const user_dto = build_user_dto();

describe("SignInContainer", () => {
  async function submit(next_path: string | null, mutation = mutation_result()) {
    vi.mocked(useSignInMutation).mockReturnValue(mutation.tuple);
    const view = render_with_store(<SignInContainer next_path={next_path} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await user.type(screen.getByLabelText("Senha"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    return { ...view, mutation };
  }

  it("starts the session and redirects to the requested internal path", async () => {
    const mutation = mutation_result();
    mutation.unwrap.mockResolvedValue(user_dto);

    const { store } = await submit("/portfolios?tab=1", mutation);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/portfolios?tab=1"));
    expect(mutation.trigger).toHaveBeenCalledWith({ email: "maria@example.com", password: "secret" });
    expect(store.getState().session.current_user).toEqual(user_dto);
    expect(router.refresh).toHaveBeenCalled();
  });

  it.each([null, "https://evil.com", "//evil.com"])("falls back to the dashboard for next=%s", async (next_path) => {
    const mutation = mutation_result();
    mutation.unwrap.mockResolvedValue(user_dto);

    await submit(next_path, mutation);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("stays on the page when sign in fails", async () => {
    const mutation = mutation_result();
    mutation.unwrap.mockRejectedValue(API_ERROR);

    const { store } = await submit(null, mutation);

    await waitFor(() => expect(mutation.unwrap).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
    expect(store.getState().session.current_user).toBeNull();
  });

  it("renders the API error, pending state and sign up link", () => {
    vi.mocked(useSignInMutation).mockReturnValue(mutation_result({ error: API_ERROR, isLoading: true }).tuple);
    render_with_store(<SignInContainer next_path={null} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem da API");
    expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Cadastre-se" })).toHaveAttribute("href", "/sign_up");
  });
});

describe("SignUpContainer", () => {
  async function submit(mutation: ReturnType<typeof mutation_result>) {
    vi.mocked(useSignUpMutation).mockReturnValue(mutation.tuple);
    const view = render_with_store(<SignUpContainer />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nome"), "Maria");
    await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await user.type(screen.getByLabelText("Senha"), "12345678");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    return view;
  }

  it("creates the account and goes to portfolios", async () => {
    const mutation = mutation_result();
    mutation.unwrap.mockResolvedValue(user_dto);

    const { store } = await submit(mutation);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/portfolios"));
    expect(store.getState().session.current_user).toEqual(user_dto);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("stays on the page when sign up fails", async () => {
    const mutation = mutation_result();
    mutation.unwrap.mockRejectedValue(API_ERROR);

    await submit(mutation);

    await waitFor(() => expect(mutation.unwrap).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renders the API error and the sign in link", () => {
    vi.mocked(useSignUpMutation).mockReturnValue(mutation_result({ error: API_ERROR }).tuple);
    render_with_store(<SignUpContainer />);
    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem da API");
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/sign_in");
  });
});

describe("ForgotPasswordContainer", () => {
  it("requests the reset link", async () => {
    const mutation = mutation_result();
    vi.mocked(useForgotPasswordMutation).mockReturnValue(mutation.tuple);
    render_with_store(<ForgotPasswordContainer />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    await waitFor(() => expect(mutation.trigger).toHaveBeenCalledWith({ email: "maria@example.com" }));
  });

  it("swallows request errors (rendered from the mutation state)", async () => {
    const mutation = mutation_result();
    mutation.unwrap.mockRejectedValue(API_ERROR);
    vi.mocked(useForgotPasswordMutation).mockReturnValue(mutation.tuple);
    render_with_store(<ForgotPasswordContainer />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail"), "maria@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    await waitFor(() => expect(mutation.unwrap).toHaveBeenCalled());
  });

  it("shows the success message", () => {
    vi.mocked(useForgotPasswordMutation).mockReturnValue(mutation_result({ data: { message: "Link enviado" } }).tuple);
    render_with_store(<ForgotPasswordContainer />);
    expect(screen.getByText("Link enviado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para o login" })).toHaveAttribute("href", "/sign_in");
  });

  it("shows the error message", () => {
    vi.mocked(useForgotPasswordMutation).mockReturnValue(mutation_result({ error: API_ERROR }).tuple);
    render_with_store(<ForgotPasswordContainer />);
    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem da API");
  });
});

describe("ResetPasswordContainer", () => {
  async function submit(mutation: ReturnType<typeof mutation_result>) {
    vi.mocked(useResetPasswordMutation).mockReturnValue(mutation.tuple);
    render_with_store(<ResetPasswordContainer token="raw_token" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nova senha"), "12345678");
    await user.type(screen.getByLabelText("Confirme a nova senha"), "12345678");
    await user.click(screen.getByRole("button", { name: "Redefinir senha" }));
  }

  beforeEach(() => {
    vi.mocked(useResetPasswordMutation).mockReturnValue(mutation_result().tuple);
  });

  it("shows an error without token", () => {
    render_with_store(<ResetPasswordContainer token={null} />);
    expect(screen.getByText("Link de recuperação inválido. Solicite um novo link.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  });

  it("resets the password and goes to sign in", async () => {
    const mutation = mutation_result();
    mutation.unwrap.mockResolvedValue({ message: "Senha redefinida com sucesso." });

    await submit(mutation);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sign_in"));
    expect(mutation.trigger).toHaveBeenCalledWith({ token: "raw_token", password: "12345678" });
    expect(toast.success).toHaveBeenCalledWith("Senha redefinida com sucesso.");
  });

  it("stays on the page when the token is rejected", async () => {
    const mutation = mutation_result();
    mutation.unwrap.mockRejectedValue(API_ERROR);

    await submit(mutation);

    await waitFor(() => expect(mutation.unwrap).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renders the API error", () => {
    vi.mocked(useResetPasswordMutation).mockReturnValue(mutation_result({ error: API_ERROR }).tuple);
    render_with_store(<ResetPasswordContainer token="raw_token" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem da API");
  });
});
