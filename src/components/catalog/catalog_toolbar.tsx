import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ASSET_TYPE_LABELS,
  FIXED_INCOME_TYPES,
  VARIABLE_INCOME_TYPES,
} from "@/lib/asset_labels";
import type { AssetType } from "@/types/api";

export type CatalogGroupOption = "VARIABLE_INCOME" | "FIXED_INCOME";

export type CatalogToolbarProps = {
  group: CatalogGroupOption;
  type: AssetType | "ALL";
  search_text: string;
  on_group_change: (group: CatalogGroupOption) => void;
  on_type_change: (type: AssetType | "ALL") => void;
  on_search_change: (text: string) => void;
};

export function CatalogToolbar({
  group,
  type,
  search_text,
  on_group_change,
  on_type_change,
  on_search_change,
}: CatalogToolbarProps) {
  const group_types = group === "VARIABLE_INCOME" ? VARIABLE_INCOME_TYPES : FIXED_INCOME_TYPES;
  const type_items = [
    { value: "ALL", label: "Todos os tipos" },
    ...group_types.map((item) => ({ value: item, label: ASSET_TYPE_LABELS[item] })),
  ];

  return (
    <div className="space-y-4">
      <Tabs value={group} onValueChange={(value) => on_group_change(value as CatalogGroupOption)}>
        <TabsList>
          <TabsTrigger value="VARIABLE_INCOME">Renda variável</TabsTrigger>
          <TabsTrigger value="FIXED_INCOME">Renda fixa</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por código ou nome (ex.: PETR4, Tesouro)"
            value={search_text}
            onChange={(event) => on_search_change(event.target.value)}
            aria-label="Buscar ativos"
          />
        </div>
        <Select
          items={type_items}
          value={type}
          onValueChange={(value) => on_type_change((value ?? "ALL") as AssetType | "ALL")}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {type_items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
