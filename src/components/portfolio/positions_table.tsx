import { PriceStatusBadge, SignedValue } from "@/components/common/value_text";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ASSET_TYPE_LABELS } from "@/lib/asset_labels";
import { format_brl, format_number } from "@/lib/format";
import type { PositionDto } from "@/types/api";

type PositionsTableProps = {
  positions: PositionDto[];
};

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ativo</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead className="text-right">Preço médio</TableHead>
            <TableHead className="text-right">Preço atual</TableHead>
            <TableHead className="text-right">Valor atual</TableHead>
            <TableHead className="text-right">Resultado</TableHead>
            <TableHead className="text-right">Realizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.asset.id} className={position.quantity === 0 ? "opacity-60" : undefined}>
              <TableCell>
                <div className="font-medium">{position.asset.code}</div>
                <div className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[position.asset.type]}</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{format_number(position.quantity)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {position.quantity > 0 ? format_brl(position.average_price) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <div>{format_brl(position.current_price)}</div>
                {position.quantity > 0 && <PriceStatusBadge status={position.price_status} />}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {position.quantity > 0 ? format_brl(position.current_value) : "Encerrada"}
              </TableCell>
              <TableCell className="text-right">
                <div>
                  <SignedValue value={position.unrealized_result} />
                </div>
                <div className="text-xs">
                  <SignedValue value={position.result_percent} kind="percent" />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <SignedValue value={position.realized_result} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
