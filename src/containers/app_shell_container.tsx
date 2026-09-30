"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app_shell";
import { useSignOutMutation } from "@/store/api/auth_api";
import { base_api } from "@/store/api/base_api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { select_current_user, signed_out } from "@/store/slices/session_slice";

export function AppShellContainer({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const current_user = useAppSelector(select_current_user);
  const [sign_out, { isLoading: is_signing_out }] = useSignOutMutation();

  const handle_sign_out = async () => {
    try {
      await sign_out().unwrap();
    } finally {
      // Clear every cached server response so the next user starts clean.
      dispatch(signed_out());
      dispatch(base_api.util.resetApiState());
      router.replace("/sign_in");
      router.refresh();
    }
  };

  return (
    <AppShell
      user_name={current_user?.name ?? null}
      current_path={pathname}
      is_signing_out={is_signing_out}
      on_sign_out={handle_sign_out}
    >
      {children}
    </AppShell>
  );
}
