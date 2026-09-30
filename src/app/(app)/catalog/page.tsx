import type { Metadata } from "next";
import { CatalogContainer, type CatalogUrlFilters } from "@/containers/catalog_container";
import { AssetType } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Catálogo" };

const GROUPS = ["VARIABLE_INCOME", "FIXED_INCOME"] as const;

function first_value(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads only well-formed filters from the URL; returns null when there is nothing to hydrate. */
function parse_url_filters(search: Record<string, string | string[] | undefined>): CatalogUrlFilters | null {
  const filters: CatalogUrlFilters = {};
  const group = first_value(search.group);
  const type = first_value(search.type);
  const q = first_value(search.q);
  const page = Number(first_value(search.page));

  if (GROUPS.includes(group as (typeof GROUPS)[number])) filters.group = group as CatalogUrlFilters["group"];
  if (type && type in AssetType) filters.type = type as AssetType;
  if (q) filters.q = q.slice(0, 50);
  if (Number.isInteger(page) && page > 0) filters.page = page;

  return Object.keys(filters).length > 0 ? filters : null;
}

export default async function CatalogPage({ searchParams: search_params }: PageProps<"/catalog">) {
  return <CatalogContainer url_filters={parse_url_filters(await search_params)} />;
}
