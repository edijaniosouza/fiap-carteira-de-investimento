import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormError, FormField } from "@/components/common/form_field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sign_in_schema } from "@/lib/validators/auth_validators";

export type SignInValues = z.output<typeof sign_in_schema>;

type SignInFormProps = {
  is_submitting: boolean;
  error_message: string | null;
  on_submit: (values: SignInValues) => void;
};

export function SignInForm({ is_submitting, error_message, on_submit }: SignInFormProps) {
  const {
    register,
    handleSubmit: handle_submit,
    formState: { errors },
  } = useForm<z.input<typeof sign_in_schema>, unknown, SignInValues>({
    resolver: zodResolver(sign_in_schema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <form className="grid gap-4" onSubmit={handle_submit(on_submit)} noValidate>
      <FormError message={error_message} />
      <FormField id="email" label="E-mail" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </FormField>
      <FormField id="password" label="Senha" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
      </FormField>
      <div className="-mt-2 text-right text-sm">
        <Link href="/forgot_password" className="text-muted-foreground underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Button type="submit" disabled={is_submitting}>
        {is_submitting ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
