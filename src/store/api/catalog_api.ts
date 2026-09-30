import { base_api } from "@/store/api/base_api";
import type { AssetDto, CatalogQuery, PaginatedResponse } from "@/types/api";

export const catalog_api = base_api.injectEndpoints({
  endpoints: (build) => ({
    getCatalog: build.query<PaginatedResponse<AssetDto>, CatalogQuery>({
      query: (params) => ({ url: "/catalog", params }),
      providesTags: ["Catalog"],
      keepUnusedDataFor: 300,
    }),
  }),
});

export const { useGetCatalogQuery } = catalog_api;
