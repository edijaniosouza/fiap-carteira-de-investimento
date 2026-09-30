import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormError, FormField } from "@/components/common/form_field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgot_password_schema } from "@/lib/validators/auth_validators";

export type ForgotPasswordValues = z.output<typeof forgot_password_schema>;

type ForgotPasswordFormProps = {
  is_submitting: boolean;
  error_message: string | null;
  success_message: string | null;
  on_submit: (values: ForgotPasswordValues) => void;
};

export function ForgotPasswordForm({
  is_submitting,
  error_message,
  success_message,
  on_submit,
}: ForgotPasswordFormProps) {
  const {
    register,
    handleSubmit: handle_submit,
    formState: { errors },
  } = useForm<z.input<typeof forgot_password_schema>, unknown, ForgotPasswordValues>({
    resolver: zodResolver(forgot_password_schema),
    defaultValues: { email: "" },
  });

  if (success_message) {
    return (
      <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
        {success_message}
      </p>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handle_submit(on_submit)} noValidate>
      <FormError message={error_message} />
      <FormField id="email" label="E-mail" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </FormField>
      <Button type="submit" disabled={is_submitting}>
        {is_submitting ? "Enviando..." : "Enviar link de recuperação"}
      </Button>
    </form>
  );
}
