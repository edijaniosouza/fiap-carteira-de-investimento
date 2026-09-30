import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  is_open: boolean;
  title: string;
  description: string;
  confirm_label?: string;
  is_pending?: boolean;
  on_confirm: () => void;
  on_cancel: () => void;
};

export function ConfirmDialog({
  is_open,
  title,
  description,
  confirm_label = "Excluir",
  is_pending = false,
  on_confirm,
  on_cancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={is_open} onOpenChange={(open) => !open && on_cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={is_pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={is_pending} onClick={on_confirm}>
            {is_pending ? "Excluindo..." : confirm_label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
