import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FormError, FormField } from "@/components/common/form_field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format_brl } from "@/lib/format";
import { transaction_schema } from "@/lib/validators/portfolio_validators";
import type { TransactionType } from "@/types/api";

const transaction_form_schema = transaction_schema.omit({ asset_id: true });

export type TransactionFormValues = z.output<typeof transaction_form_schema>;

export type TransactionFormDefaults = {
  type: TransactionType;
  quantity: number | "";
  unit_price: number | "";
  trade_date: string;
};

type TransactionFormDialogProps = {
  is_open: boolean;
  is_editing: boolean;
  default_values: TransactionFormDefaults;
  current_price: number | null;
  is_pending: boolean;
  error_message: string | null;
  asset_error: string | null;
  asset_picker: ReactNode;
  on_submit: (values: TransactionFormValues) => void;
  on_close: () => void;
};

export function TransactionFormDialog({
  is_open,
  is_editing,
  default_values,
  current_price,
  is_pending,
  error_message,
  asset_error,
  asset_picker,
  on_submit,
  on_close,
}: TransactionFormDialogProps) {
  const {
    register,
    control,
    handleSubmit: handle_submit,
    formState: { errors },
  } = useForm<z.input<typeof transaction_form_schema>, unknown, TransactionFormValues>({
    resolver: zodResolver(transaction_form_schema),
    values: default_values,
  });

  return (
    <Dialog open={is_open} onOpenChange={(open) => !open && on_close()}>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-4" onSubmit={handle_submit(on_submit)} noValidate>
          <DialogHeader>
            <DialogTitle>{is_editing ? "Editar transação" : "Nova transação"}</DialogTitle>
            <DialogDescription>Registre uma compra ou venda de ativo nesta carteira.</DialogDescription>
          </DialogHeader>
          <FormError message={error_message} />
          <FormField id="asset_search" label="Ativo" error={asset_error ?? undefined}>
            {asset_picker}
          </FormField>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Tabs value={field.value} onValueChange={(value) => field.onChange(value)}>
                <TabsList className="w-full">
                  <TabsTrigger value="BUY">Compra</TabsTrigger>
                  <TabsTrigger value="SELL">Venda</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="quantity" label="Quantidade" error={errors.quantity?.message}>
              <Input id="quantity" type="number" inputMode="decimal" step="any" min="0" {...register("quantity")} />
            </FormField>
            <FormField
              id="unit_price"
              label="Preço unitário (R$)"
              error={errors.unit_price?.message}
              hint={current_price != null ? `Cotação atual: ${format_brl(current_price)}` : undefined}
            >
              <Input id="unit_price" type="number" inputMode="decimal" step="any" min="0" {...register("unit_price")} />
            </FormField>
          </div>
          <FormField id="trade_date" label="Data da operação" error={errors.trade_date?.message}>
            <Input id="trade_date" type="date" {...register("trade_date")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={on_close} disabled={is_pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={is_pending}>
              {is_pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
