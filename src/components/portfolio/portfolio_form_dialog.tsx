import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { portfolio_schema } from "@/lib/validators/portfolio_validators";

export type PortfolioFormValues = z.output<typeof portfolio_schema>;

type PortfolioFormDialogProps = {
  is_open: boolean;
  initial_name: string;
  is_editing: boolean;
  is_pending: boolean;
  error_message: string | null;
  on_submit: (values: PortfolioFormValues) => void;
  on_close: () => void;
};

export function PortfolioFormDialog({
  is_open,
  initial_name,
  is_editing,
  is_pending,
  error_message,
  on_submit,
  on_close,
}: PortfolioFormDialogProps) {
  const {
    register,
    handleSubmit: handle_submit,
    formState: { errors },
  } = useForm<z.input<typeof portfolio_schema>, unknown, PortfolioFormValues>({
    resolver: zodResolver(portfolio_schema),
    values: { name: initial_name },
  });

  return (
    <Dialog open={is_open} onOpenChange={(open) => !open && on_close()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handle_submit(on_submit)} noValidate>
          <DialogHeader>
            <DialogTitle>{is_editing ? "Renomear carteira" : "Nova carteira"}</DialogTitle>
            <DialogDescription>Dê um nome para identificar sua carteira.</DialogDescription>
          </DialogHeader>
          <FormError message={error_message} />
          <FormField id="portfolio_name" label="Nome" error={errors.name?.message}>
            <Input id="portfolio_name" autoFocus {...register("name")} />
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
