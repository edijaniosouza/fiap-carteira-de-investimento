import { base_api } from "@/store/api/base_api";
import type { QuoteDto } from "@/types/api";

export const quote_api = base_api.injectEndpoints({
  endpoints: (build) => ({
    getQuote: build.query<QuoteDto, string>({
      query: (asset_id) => `/quotes/${asset_id}`,
      providesTags: (_result, _error, asset_id) => [{ type: "Quote", id: asset_id }],
      // Matches the 30-minute server cache.
      keepUnusedDataFor: 30 * 60,
    }),
  }),
});

export const { useGetQuoteQuery } = quote_api;
