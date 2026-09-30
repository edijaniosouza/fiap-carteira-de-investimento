import { CalculatorIcon, PlusIcon } from "lucide-react";
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
import { ASSET_TYPE_LABELS, describe_fixed_income_rate, is_variable_income } from "@/lib/asset_labels";
import { format_brl, format_date } from "@/lib/format";
import type { AssetDto } from "@/types/api";

type CatalogTableProps = {
  assets: AssetDto[];
  on_buy: (asset: AssetDto) => void;
  on_simulate: (asset: AssetDto) => void;
};

function describe_asset_terms(asset: AssetDto): string {
  if (is_variable_income(asset.type)) {
    return format_brl(asset.last_price);
  }
  const rate = describe_fixed_income_rate(asset.indexer, asset.rate);
  return asset.maturity_date ? `${rate} · vence ${format_date(asset.maturity_date)}` : rate;
}

export function CatalogTable({ assets, on_buy, on_simulate }: CatalogTableProps) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Preço / Rentabilidade</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell className="font-medium">{asset.code}</TableCell>
              <TableCell className="max-w-64 truncate" title={asset.name}>
                {asset.name}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{ASSET_TYPE_LABELS[asset.type]}</Badge>
              </TableCell>
              <TableCell className="tabular-nums">{describe_asset_terms(asset)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => on_simulate(asset)}>
                    <CalculatorIcon /> Simular
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => on_buy(asset)}>
                    <PlusIcon /> Registrar compra
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
