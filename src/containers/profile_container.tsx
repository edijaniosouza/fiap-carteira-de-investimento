"use client";

import { toast } from "sonner";
import { PageHeader } from "@/components/common/page_header";
import { ErrorState, LoadingState } from "@/components/common/state_views";
import {
  PasswordForm,
  type PasswordFormValues,
  ProfileForm,
  type ProfileFormValues,
} from "@/components/profile/profile_forms";
import { useGetProfileQuery, useUpdateProfileMutation } from "@/store/api/auth_api";
import { get_error_message } from "@/store/api/base_api";
import { useAppDispatch } from "@/store/hooks";
import { profile_updated } from "@/store/slices/session_slice";

export function ProfileContainer() {
  const dispatch = useAppDispatch();
  const { data: profile, isLoading: is_loading, error, refetch } = useGetProfileQuery();
  const [update_profile, profile_state] = useUpdateProfileMutation({ fixedCacheKey: "profile_data" });
  const [update_password, password_state] = useUpdateProfileMutation({ fixedCacheKey: "profile_password" });

  const handle_profile_submit = async (values: ProfileFormValues) => {
    try {
      const user = await update_profile({
        name: values.name,
        email: values.email,
        current_password: values.current_password || undefined,
      }).unwrap();
      dispatch(profile_updated(user));
      toast.success("Perfil atualizado");
    } catch {
      // Error message is rendered from the mutation state.
    }
  };

  const handle_password_submit = async (values: PasswordFormValues): Promise<boolean> => {
    try {
      await update_password({
        current_password: values.current_password,
        new_password: values.new_password,
      }).unwrap();
      toast.success("Senha alterada");
      return true;
    } catch {
      return false;
    }
  };

  if (is_loading) {
    return <LoadingState rows={4} />;
  }
  if (error || !profile) {
    return <ErrorState message={get_error_message(error)} on_retry={refetch} />;
  }

  return (
    <>
      <PageHeader title="Perfil" description="Gerencie seus dados de acesso" />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm
          default_values={{ name: profile.name, email: profile.email }}
          is_pending={profile_state.isLoading}
          error_message={profile_state.error ? get_error_message(profile_state.error) : null}
          on_submit={handle_profile_submit}
        />
        <PasswordForm
          is_pending={password_state.isLoading}
          error_message={password_state.error ? get_error_message(password_state.error) : null}
          on_submit={handle_password_submit}
        />
      </div>
    </>
  );
}
