import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError, FormField } from "@/components/common/form_field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reset_password_schema } from "@/lib/validators/auth_validators";

const reset_password_form_schema = reset_password_schema
  .pick({ password: true })
  .extend({ password_confirmation: z.string() })
  .refine((data) => data.password === data.password_confirmation, {
    message: "As senhas não conferem",
    path: ["password_confirmation"],
  });

export type ResetPasswordValues = z.output<typeof reset_password_form_schema>;

type ResetPasswordFormProps = {
  is_submitting: boolean;
  error_message: string | null;
  on_submit: (values: ResetPasswordValues) => void;
};

export function ResetPasswordForm({ is_submitting, error_message, on_submit }: ResetPasswordFormProps) {
  const {
    register,
    handleSubmit: handle_submit,
    formState: { errors },
  } = useForm<z.input<typeof reset_password_form_schema>, unknown, ResetPasswordValues>({
    resolver: zodResolver(reset_password_form_schema),
    defaultValues: { password: "", password_confirmation: "" },
  });

  return (
    <form className="grid gap-4" onSubmit={handle_submit(on_submit)} noValidate>
      <FormError message={error_message} />
      <FormField id="password" label="Nova senha" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </FormField>
      <FormField
        id="password_confirmation"
        label="Confirme a nova senha"
        error={errors.password_confirmation?.message}
      >
        <Input
          id="password_confirmation"
          type="password"
          autoComplete="new-password"
          {...register("password_confirmation")}
        />
      </FormField>
      <Button type="submit" disabled={is_submitting}>
        {is_submitting ? "Salvando..." : "Redefinir senha"}
      </Button>
    </form>
  );
}
