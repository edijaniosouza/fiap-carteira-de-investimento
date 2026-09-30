"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthCard, AuthFooterLink } from "@/components/auth/auth_card";
import {
  ResetPasswordForm,
  type ResetPasswordValues,
} from "@/components/auth/reset_password_form";
import { ErrorState } from "@/components/common/state_views";
import { useResetPasswordMutation } from "@/store/api/auth_api";
import { get_error_message } from "@/store/api/base_api";

export function ResetPasswordContainer({ token }: { token: string | null }) {
  const router = useRouter();
  const [reset_password, { isLoading: is_loading, error }] = useResetPasswordMutation();

  const handle_submit = async (values: ResetPasswordValues) => {
    if (!token) return;
    try {
      const response = await reset_password({ token, password: values.password }).unwrap();
      toast.success(response.message);
      router.replace("/sign_in");
    } catch {
      // Error message is rendered from the mutation state.
    }
  };

  return (
    <AuthCard
      title="Redefinir senha"
      description="Escolha uma nova senha para sua conta"
      footer={<AuthFooterLink href="/sign_in" label="Voltar para o login" />}
    >
      {token ? (
        <ResetPasswordForm
          is_submitting={is_loading}
          error_message={error ? get_error_message(error) : null}
          on_submit={handle_submit}
        />
      ) : (
        <ErrorState message="Link de recuperação inválido. Solicite um novo link." />
      )}
    </AuthCard>
  );
}
