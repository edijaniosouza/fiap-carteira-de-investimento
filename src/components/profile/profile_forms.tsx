import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormError, FormField } from "@/components/common/form_field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sign_up_schema } from "@/lib/validators/auth_validators";

const profile_form_schema = sign_up_schema
  .pick({ name: true, email: true })
  .extend({ current_password: z.string().optional() });

export type ProfileFormValues = z.output<typeof profile_form_schema>;

type ProfileFormProps = {
  default_values: { name: string; email: string };
  is_pending: boolean;
  error_message: string | null;
  on_submit: (values: ProfileFormValues) => void;
};

export function ProfileForm({ default_values, is_pending, error_message, on_submit }: ProfileFormProps) {
  const {
    register,
    control,
    handleSubmit: handle_submit,
    formState: { errors },
  } = useForm<z.input<typeof profile_form_schema>, unknown, ProfileFormValues>({
    resolver: zodResolver(profile_form_schema),
    values: { ...default_values, current_password: "" },
  });
  const email = useWatch({ control, name: "email" });
  const is_email_changed = email?.trim().toLowerCase() !== default_values.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados pessoais</CardTitle>
        <CardDescription>Alterar o e-mail exige a senha atual.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handle_submit(on_submit)} noValidate>
          <FormError message={error_message} />
          <FormField id="name" label="Nome" error={errors.name?.message}>
            <Input id="name" autoComplete="name" {...register("name")} />
          </FormField>
          <FormField id="email" label="E-mail" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
          </FormField>
          {is_email_changed && (
            <FormField id="profile_current_password" label="Senha atual" error={errors.current_password?.message}>
              <Input
                id="profile_current_password"
                type="password"
                autoComplete="current-password"
                {...register("current_password")}
              />
            </FormField>
          )}
          <Button type="submit" className="justify-self-start" disabled={is_pending}>
            {is_pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const password_form_schema = z
  .object({
    current_password: z.string().min(1, "Informe a senha atual"),
    new_password: sign_up_schema.shape.password,
    password_confirmation: z.string(),
  })
  .refine((data) => data.new_password === data.password_confirmation, {
    message: "As senhas não conferem",
    path: ["password_confirmation"],
  });

export type PasswordFormValues = z.output<typeof password_form_schema>;

type PasswordFormProps = {
  is_pending: boolean;
  error_message: string | null;
  on_submit: (values: PasswordFormValues) => Promise<boolean>;
};

export function PasswordForm({ is_pending, error_message, on_submit }: PasswordFormProps) {
  const {
    register,
    reset,
    handleSubmit: handle_submit,
    formState: { errors },
  } = useForm<z.input<typeof password_form_schema>, unknown, PasswordFormValues>({
    resolver: zodResolver(password_form_schema),
    defaultValues: { current_password: "", new_password: "", password_confirmation: "" },
  });

  const submit = async (values: PasswordFormValues) => {
    if (await on_submit(values)) {
      reset();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alterar senha</CardTitle>
        <CardDescription>Use ao menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handle_submit(submit)} noValidate>
          <FormError message={error_message} />
          <FormField id="current_password" label="Senha atual" error={errors.current_password?.message}>
            <Input id="current_password" type="password" autoComplete="current-password" {...register("current_password")} />
          </FormField>
          <FormField id="new_password" label="Nova senha" error={errors.new_password?.message}>
            <Input id="new_password" type="password" autoComplete="new-password" {...register("new_password")} />
          </FormField>
          <FormField id="password_confirmation" label="Confirme a nova senha" error={errors.password_confirmation?.message}>
            <Input
              id="password_confirmation"
              type="password"
              autoComplete="new-password"
              {...register("password_confirmation")}
            />
          </FormField>
          <Button type="submit" className="justify-self-start" disabled={is_pending}>
            {is_pending ? "Salvando..." : "Alterar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
