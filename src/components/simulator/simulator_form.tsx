import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormError, FormField } from "@/components/common/form_field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { simulation_schema } from "@/lib/validators/portfolio_validators";

const simulator_form_schema = simulation_schema.omit({ asset_id: true });

export type SimulatorFormValues = z.output<typeof simulator_form_schema>;

type SimulatorFormProps = {
  default_values: SimulatorFormValues;
  asset_picker: ReactNode;
  asset_error: string | null;
  error_message: string | null;
  is_pending: boolean;
  on_submit: (values: SimulatorFormValues) => void;
};

export function SimulatorForm({
  default_values,
  asset_picker,
  asset_error,
  error_message,
  is_pending,
  on_submit,
}: SimulatorFormProps) {
  const {
    register,
    handleSubmit: handle_submit,
    formState: { errors },
  } = useForm<z.input<typeof simulator_form_schema>, unknown, SimulatorFormValues>({
    resolver: zodResolver(simulator_form_schema),
    defaultValues: default_values,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parâmetros</CardTitle>
        <CardDescription>Simulação com base na taxa/cotação atual (valores estimados).</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handle_submit(on_submit)} noValidate>
          <FormError message={error_message} />
          <FormField id="asset_search" label="Ativo" error={asset_error ?? undefined}>
            {asset_picker}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="amount" label="Valor a investir (R$)" error={errors.amount?.message}>
              <Input id="amount" type="number" inputMode="decimal" step="any" min="0" {...register("amount")} />
            </FormField>
            <FormField id="months" label="Prazo (meses)" error={errors.months?.message}>
              <Input id="months" type="number" inputMode="numeric" step="1" min="1" {...register("months")} />
            </FormField>
          </div>
          <Button type="submit" disabled={is_pending}>
            {is_pending ? "Simulando..." : "Simular"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
