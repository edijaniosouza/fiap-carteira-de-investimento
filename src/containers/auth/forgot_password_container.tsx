"use client";

import { AuthCard, AuthFooterLink } from "@/components/auth/auth_card";
import {
  ForgotPasswordForm,
  type ForgotPasswordValues,
} from "@/components/auth/forgot_password_form";
import { useForgotPasswordMutation } from "@/store/api/auth_api";
import { get_error_message } from "@/store/api/base_api";

export function ForgotPasswordContainer() {
  const [forgot_password, { isLoading: is_loading, error, data }] = useForgotPasswordMutation();

  const handle_submit = async (values: ForgotPasswordValues) => {
    try {
      await forgot_password(values).unwrap();
    } catch {
      // Error message is rendered from the mutation state.
    }
  };

  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe seu e-mail para receber um link de redefinição"
      footer={<AuthFooterLink href="/sign_in" label="Voltar para o login" />}
    >
      <ForgotPasswordForm
        is_submitting={is_loading}
        error_message={error ? get_error_message(error) : null}
        success_message={data?.message ?? null}
        on_submit={handle_submit}
      />
    </AuthCard>
  );
}
