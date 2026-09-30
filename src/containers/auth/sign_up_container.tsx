"use client";

import { useRouter } from "next/navigation";
import { AuthCard, AuthFooterLink } from "@/components/auth/auth_card";
import { SignUpForm, type SignUpValues } from "@/components/auth/sign_up_form";
import { useSignUpMutation } from "@/store/api/auth_api";
import { get_error_message } from "@/store/api/base_api";
import { useAppDispatch } from "@/store/hooks";
import { session_started } from "@/store/slices/session_slice";

export function SignUpContainer() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [sign_up, { isLoading: is_loading, error }] = useSignUpMutation();

  const handle_submit = async (values: SignUpValues) => {
    try {
      const user = await sign_up(values).unwrap();
      dispatch(session_started(user));
      router.replace("/portfolios");
      router.refresh();
    } catch {
      // Error message is rendered from the mutation state.
    }
  };

  return (
    <AuthCard
      title="Criar conta"
      description="Comece a acompanhar seus investimentos"
      footer={<AuthFooterLink prompt="Já tem conta?" href="/sign_in" label="Entrar" />}
    >
      <SignUpForm
        is_submitting={is_loading}
        error_message={error ? get_error_message(error) : null}
        on_submit={handle_submit}
      />
    </AuthCard>
  );
}
