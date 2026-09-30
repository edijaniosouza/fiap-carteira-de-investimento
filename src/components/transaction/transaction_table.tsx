import { PencilIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TRANSACTION_TYPE_LABELS } from "@/lib/asset_labels";
import { format_brl, format_date, format_number } from "@/lib/format";
import type { TransactionDto } from "@/types/api";

type TransactionTableProps = {
  transactions: TransactionDto[];
  on_edit: (transaction: TransactionDto) => void;
  on_delete: (transaction: TransactionDto) => void;
};

export function TransactionTable({ transactions, on_edit, on_delete }: TransactionTableProps) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead className="text-right">Preço unitário</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{format_date(transaction.trade_date)}</TableCell>
              <TableCell>
                <div className="font-medium">{transaction.asset.code}</div>
                <div className="max-w-56 truncate text-xs text-muted-foreground">{transaction.asset.name}</div>
              </TableCell>
              <TableCell>
                <Badge variant={transaction.type === "BUY" ? "secondary" : "outline"}>
                  {TRANSACTION_TYPE_LABELS[transaction.type]}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{format_number(transaction.quantity)}</TableCell>
              <TableCell className="text-right tabular-nums">{format_brl(transaction.unit_price)}</TableCell>
              <TableCell className="text-right tabular-nums">{format_brl(transaction.total)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => on_edit(transaction)}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Excluir" onClick={() => on_delete(transaction)}>
                    <Trash2Icon />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
