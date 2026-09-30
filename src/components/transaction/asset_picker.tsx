import { SearchIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSET_TYPE_LABELS } from "@/lib/asset_labels";
import type { AssetSummaryDto } from "@/types/api";

type AssetPickerProps = {
  id: string;
  selected_asset: AssetSummaryDto | null;
  search_text: string;
  options: AssetSummaryDto[];
  is_searching: boolean;
  on_search_change: (text: string) => void;
  on_select: (asset: AssetSummaryDto | null) => void;
};

/** Search-and-pick list of catalog assets. Data fetching lives in the container. */
export function AssetPicker({
  id,
  selected_asset,
  search_text,
  options,
  is_searching,
  on_search_change,
  on_select,
}: AssetPickerProps) {
  if (selected_asset) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <div className="min-w-0">
          <div className="font-medium">{selected_asset.code}</div>
          <div className="truncate text-xs text-muted-foreground">{selected_asset.name}</div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Trocar ativo" onClick={() => on_select(null)}>
          <XIcon />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          className="pl-8"
          placeholder="Digite o código ou nome do ativo"
          value={search_text}
          onChange={(event) => on_search_change(event.target.value)}
          autoComplete="off"
        />
      </div>
      <ul className="max-h-48 overflow-y-auto rounded-lg border" role="listbox" aria-label="Ativos encontrados">
        {is_searching && <li className="px-3 py-2 text-sm text-muted-foreground">Buscando...</li>}
        {!is_searching && options.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum ativo encontrado</li>
        )}
        {!is_searching &&
          options.map((asset) => (
            <li key={asset.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => on_select(asset)}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-medium">{asset.code}</span>
                  <span className="truncate text-muted-foreground">{asset.name}</span>
                </span>
                <Badge variant="outline" className="shrink-0">
                  {ASSET_TYPE_LABELS[asset.type]}
                </Badge>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
