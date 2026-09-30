"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CatalogTable } from "@/components/catalog/catalog_table";
import { CatalogToolbar } from "@/components/catalog/catalog_toolbar";
import { PageHeader } from "@/components/common/page_header";
import { Pagination } from "@/components/common/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/state_views";
import { useDebouncedValue } from "@/hooks/use_debounced_value";
import { FIXED_INCOME_TYPES, VARIABLE_INCOME_TYPES } from "@/lib/asset_labels";
import { get_error_message } from "@/store/api/base_api";
import { useGetCatalogQuery } from "@/store/api/catalog_api";
import { useGetPortfoliosQuery } from "@/store/api/portfolio_api";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks";
import {
  type CatalogFiltersState,
  filters_hydrated,
  group_changed,
  page_changed,
  query_changed,
  select_catalog_filters,
  type_changed,
} from "@/store/slices/catalog_filters_slice";
import { simulation_asset_selected } from "@/store/slices/simulator_slice";
import { purchase_requested } from "@/store/slices/ui_slice";
import type { AssetDto, AssetSummaryDto } from "@/types/api";

export type CatalogUrlFilters = Partial<Pick<CatalogFiltersState, "group" | "type" | "q" | "page">>;

function to_query_types(filters: CatalogFiltersState): string {
  if (filters.type !== "ALL") {
    return filters.type;
  }
  return (filters.group === "VARIABLE_INCOME" ? VARIABLE_INCOME_TYPES : FIXED_INCOME_TYPES).join(",");
}

function to_url_query(filters: CatalogFiltersState): string {
  const params = new URLSearchParams({ group: filters.group, page: String(filters.page) });
  if (filters.type !== "ALL") params.set("type", filters.type);
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

function to_asset_summary(asset: AssetDto): AssetSummaryDto {
  const { id, code, name, type, indexer, rate } = asset;
  return { id, code, name, type, indexer, rate };
}

/**
 * Filters live in Redux (remembered across navigation) and are mirrored in the URL.
 * URL params, when present, win on first render (deep links).
 */
export function CatalogContainer({ url_filters }: { url_filters: CatalogUrlFilters | null }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const filters = useAppSelector(select_catalog_filters);
  const [search_text, set_search_text] = useState(url_filters?.q ?? filters.q);
  const debounced_search = useDebouncedValue(search_text.trim(), 350);
  const is_hydrated_ref = useRef(false);
  const url_query = to_url_query(filters);

  const { data, isFetching: is_fetching, isLoading: is_loading, error, refetch } = useGetCatalogQuery({
    type: to_query_types(filters),
    q: filters.q,
    page: filters.page,
    limit: filters.limit,
  });
  const { data: portfolios } = useGetPortfoliosQuery();

  // Mirrors filters into the URL (declared before hydration so the first pass is skipped).
  useEffect(() => {
    if (is_hydrated_ref.current && url_query !== window.location.search.slice(1)) {
      router.replace(`/catalog?${url_query}`, { scroll: false });
    }
  }, [router, url_query]);

  useEffect(() => {
    if (url_filters) {
      dispatch(filters_hydrated(url_filters));
    }
    is_hydrated_ref.current = true;
  }, [dispatch, url_filters]);

  useEffect(() => {
    if (debounced_search !== select_catalog_filters(store.getState()).q) {
      dispatch(query_changed(debounced_search));
    }
  }, [dispatch, store, debounced_search]);

  const handle_buy = (asset: AssetDto) => {
    const portfolio = portfolios?.items[0];
    if (!portfolio) {
      toast.info("Crie uma carteira antes de registrar compras.");
      router.push("/portfolios");
      return;
    }
    dispatch(purchase_requested(to_asset_summary(asset)));
    router.push(`/portfolios/${portfolio.id}/transactions`);
  };

  const handle_simulate = (asset: AssetDto) => {
    dispatch(simulation_asset_selected(to_asset_summary(asset)));
    router.push("/simulator");
  };

  return (
    <>
      <PageHeader title="Catálogo" description="Ativos de renda fixa e variável disponíveis" />
      <CatalogToolbar
        group={filters.group}
        type={filters.type}
        search_text={search_text}
        on_group_change={(group) => dispatch(group_changed(group))}
        on_type_change={(type) => dispatch(type_changed(type))}
        on_search_change={set_search_text}
      />
      {is_loading && <LoadingState rows={8} />}
      {error && <ErrorState message={get_error_message(error)} on_retry={refetch} />}
      {data && data.items.length === 0 && (
        <EmptyState title="Nenhum ativo encontrado" description="Tente outro termo ou tipo de ativo." />
      )}
      {data && data.items.length > 0 && (
        <div className={is_fetching ? "opacity-60 transition-opacity" : undefined}>
          <CatalogTable assets={data.items} on_buy={handle_buy} on_simulate={handle_simulate} />
        </div>
      )}
      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          total_pages={data.total_pages}
          total={data.total}
          on_page_change={(page) => dispatch(page_changed(page))}
        />
      )}
    </>
  );
}
