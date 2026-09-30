import { base_api } from "@/store/api/base_api";
import type {
  PortfolioDto,
  PortfolioListResponse,
  PortfolioRequest,
  PortfolioSummaryDto,
  PositionDto,
} from "@/types/api";

const LIST_ID = "LIST";

export const portfolio_api = base_api.injectEndpoints({
  endpoints: (build) => ({
    getPortfolios: build.query<PortfolioListResponse, void>({
      query: () => "/portfolios",
      providesTags: (result) => [
        { type: "Portfolio", id: LIST_ID },
        ...(result?.items.map((portfolio) => ({ type: "Portfolio" as const, id: portfolio.id })) ?? []),
      ],
    }),
    getPortfolioSummary: build.query<PortfolioSummaryDto, string>({
      query: (portfolio_id) => `/portfolios/${portfolio_id}`,
      providesTags: (_result, _error, portfolio_id) => [
        { type: "Portfolio", id: portfolio_id },
        { type: "Position", id: portfolio_id },
      ],
    }),
    getPositions: build.query<PositionDto[], string>({
      query: (portfolio_id) => `/portfolios/${portfolio_id}/positions`,
      providesTags: (_result, _error, portfolio_id) => [{ type: "Position", id: portfolio_id }],
    }),
    createPortfolio: build.mutation<PortfolioDto, PortfolioRequest>({
      query: (body) => ({ url: "/portfolios", method: "POST", body }),
      invalidatesTags: [{ type: "Portfolio", id: LIST_ID }],
    }),
    renamePortfolio: build.mutation<PortfolioDto, { portfolio_id: string; body: PortfolioRequest }>({
      query: ({ portfolio_id, body }) => ({ url: `/portfolios/${portfolio_id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { portfolio_id }) => [
        { type: "Portfolio", id: LIST_ID },
        { type: "Portfolio", id: portfolio_id },
      ],
    }),
    deletePortfolio: build.mutation<void, string>({
      query: (portfolio_id) => ({ url: `/portfolios/${portfolio_id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, portfolio_id) => [
        { type: "Portfolio", id: LIST_ID },
        { type: "Portfolio", id: portfolio_id },
        { type: "Position", id: portfolio_id },
        { type: "Transaction", id: portfolio_id },
      ],
    }),
  }),
});

export const {
  useGetPortfoliosQuery,
  useGetPortfolioSummaryQuery,
  useGetPositionsQuery,
  useCreatePortfolioMutation,
  useRenamePortfolioMutation,
  useDeletePortfolioMutation,
} = portfolio_api;
