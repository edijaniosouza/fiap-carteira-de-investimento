import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormError, FormField } from "@/components/common/form_field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sign_up_schema } from "@/lib/validators/auth_validators";

export type SignUpValues = z.output<typeof sign_up_schema>;

type SignUpFormProps = {
  is_submitting: boolean;
  error_message: string | null;
  on_submit: (values: SignUpValues) => void;
};

export function SignUpForm({ is_submitting, error_message, on_submit }: SignUpFormProps) {
  const {
    register,
    handleSubmit: handle_submit,
    formState: { errors },
  } = useForm<z.input<typeof sign_up_schema>, unknown, SignUpValues>({
    resolver: zodResolver(sign_up_schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  return (
    <form className="grid gap-4" onSubmit={handle_submit(on_submit)} noValidate>
      <FormError message={error_message} />
      <FormField id="name" label="Nome" error={errors.name?.message}>
        <Input id="name" autoComplete="name" {...register("name")} />
      </FormField>
      <FormField id="email" label="E-mail" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </FormField>
      <FormField
        id="password"
        label="Senha"
        error={errors.password?.message}
        hint="Mínimo de 8 caracteres"
      >
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </FormField>
      <Button type="submit" disabled={is_submitting}>
        {is_submitting ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
