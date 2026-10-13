/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordForm, ProfileForm } from "@/components/profile/profile_forms";

const default_values = { name: "Maria", email: "maria@example.com" };

describe("ProfileForm", () => {
  it("prefills the data and submits a name change", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<ProfileForm default_values={default_values} is_pending={false} error_message={null} on_submit={on_submit} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Maria");
    expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nome"));
    await user.type(screen.getByLabelText("Nome"), "Maria Souza");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(on_submit).toHaveBeenCalledWith(
        { name: "Maria Souza", email: "maria@example.com", current_password: "" },
        expect.anything(),
      ),
    );
  });

  it("asks for the current password when the e-mail changes", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<ProfileForm default_values={default_values} is_pending={false} error_message={null} on_submit={on_submit} />);

    await user.clear(screen.getByLabelText("E-mail"));
    await user.type(screen.getByLabelText("E-mail"), "new@example.com");
    await user.type(await screen.findByLabelText("Senha atual"), "old_password");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(on_submit).toHaveBeenCalledWith(
        { name: "Maria", email: "new@example.com", current_password: "old_password" },
        expect.anything(),
      ),
    );
  });

  it("does not ask for the password when only the case of the e-mail changes", async () => {
    const user = userEvent.setup();
    render(<ProfileForm default_values={default_values} is_pending={false} error_message={null} on_submit={vi.fn()} />);

    await user.clear(screen.getByLabelText("E-mail"));
    await user.type(screen.getByLabelText("E-mail"), "MARIA@example.com");

    expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();
  });

  it("validates fields and shows the pending state and errors", async () => {
    const { rerender } = render(
      <ProfileForm default_values={default_values} is_pending={false} error_message={null} on_submit={vi.fn()} />,
    );
    await userEvent.clear(screen.getByLabelText("Nome"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Informe ao menos 2 caracteres")).toBeInTheDocument();

    rerender(<ProfileForm default_values={default_values} is_pending error_message="Senha atual incorreta" on_submit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    expect(screen.getByText("Senha atual incorreta")).toBeInTheDocument();
  });
});

describe("PasswordForm", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, confirmation = "12345678") {
    await user.type(screen.getByLabelText("Senha atual"), "old_password");
    await user.type(screen.getByLabelText("Nova senha"), "12345678");
    await user.type(screen.getByLabelText("Confirme a nova senha"), confirmation);
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
  }

  it("validates required and matching passwords", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn();
    render(<PasswordForm is_pending={false} error_message={null} on_submit={on_submit} />);

    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(await screen.findByText("Informe a senha atual")).toBeInTheDocument();

    await fill(user, "different");
    expect(await screen.findByText("As senhas não conferem")).toBeInTheDocument();
    expect(on_submit).not.toHaveBeenCalled();
  });

  it("resets the form after a successful change", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn(async () => true);
    render(<PasswordForm is_pending={false} error_message={null} on_submit={on_submit} />);

    await fill(user);

    await waitFor(() =>
      expect(on_submit).toHaveBeenCalledWith({
        current_password: "old_password",
        new_password: "12345678",
        password_confirmation: "12345678",
      }),
    );
    await waitFor(() => expect(screen.getByLabelText("Senha atual")).toHaveValue(""));
  });

  it("keeps the values when the change fails", async () => {
    const user = userEvent.setup();
    const on_submit = vi.fn(async () => false);
    render(<PasswordForm is_pending={false} error_message={null} on_submit={on_submit} />);

    await fill(user);

    await waitFor(() => expect(on_submit).toHaveBeenCalled());
    expect(screen.getByLabelText("Senha atual")).toHaveValue("old_password");
  });

  it("shows the pending state and errors", () => {
    render(<PasswordForm is_pending error_message="Senha atual incorreta" on_submit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Senha atual incorreta");
  });
});
