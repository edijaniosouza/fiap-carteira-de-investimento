"use client";

import { useRouter } from "next/navigation";
import { AuthCard, AuthFooterLink } from "@/components/auth/auth_card";
import { SignInForm, type SignInValues } from "@/components/auth/sign_in_form";
import { useSignInMutation } from "@/store/api/auth_api";
import { get_error_message } from "@/store/api/base_api";
import { useAppDispatch } from "@/store/hooks";
import { session_started } from "@/store/slices/session_slice";

const DEFAULT_REDIRECT = "/dashboard";

/** Only internal paths are accepted as redirect targets (prevents open redirects). */
function resolve_redirect(next_path: string | null): string {
  return next_path && next_path.startsWith("/") && !next_path.startsWith("//") ? next_path : DEFAULT_REDIRECT;
}

export function SignInContainer({ next_path }: { next_path: string | null }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [sign_in, { isLoading: is_loading, error }] = useSignInMutation();

  const handle_submit = async (values: SignInValues) => {
    try {
      const user = await sign_in(values).unwrap();
      dispatch(session_started(user));
      router.replace(resolve_redirect(next_path));
      router.refresh();
    } catch {
      // Error message is rendered from the mutation state.
    }
  };

  return (
    <AuthCard
      title="Entrar"
      description="Acesse sua carteira de investimentos"
      footer={<AuthFooterLink prompt="Não tem conta?" href="/sign_up" label="Cadastre-se" />}
    >
      <SignInForm
        is_submitting={is_loading}
        error_message={error ? get_error_message(error) : null}
        on_submit={handle_submit}
      />
    </AuthCard>
  );
}
