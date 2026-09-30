"use client";

import { useState } from "react";
import { AssetPicker } from "@/components/transaction/asset_picker";
import { useDebouncedValue } from "@/hooks/use_debounced_value";
import { FIXED_INCOME_TYPES, VARIABLE_INCOME_TYPES } from "@/lib/asset_labels";
import { useGetCatalogQuery } from "@/store/api/catalog_api";
import type { AssetSummaryDto } from "@/types/api";

const INVESTABLE_TYPES = [...VARIABLE_INCOME_TYPES, ...FIXED_INCOME_TYPES].join(",");
const MAX_OPTIONS = 8;

type AssetPickerContainerProps = {
  id: string;
  selected_asset: AssetSummaryDto | null;
  on_select: (asset: AssetSummaryDto | null) => void;
};

/** Searches the catalog (debounced) and feeds the presentational AssetPicker. */
export function AssetPickerContainer({ id, selected_asset, on_select }: AssetPickerContainerProps) {
  const [search_text, set_search_text] = useState("");
  const debounced_search = useDebouncedValue(search_text.trim(), 300);
  const { data, isFetching: is_fetching } = useGetCatalogQuery(
    { type: INVESTABLE_TYPES, q: debounced_search, page: 1, limit: MAX_OPTIONS },
    { skip: selected_asset !== null },
  );

  return (
    <AssetPicker
      id={id}
      selected_asset={selected_asset}
      search_text={search_text}
      options={data?.items ?? []}
      is_searching={is_fetching}
      on_search_change={set_search_text}
      on_select={(asset) => {
        set_search_text("");
        on_select(asset);
      }}
    />
  );
}
