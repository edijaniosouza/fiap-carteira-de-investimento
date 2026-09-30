import { base_api } from "@/store/api/base_api";
import type { TransactionDto, TransactionRequest } from "@/types/api";

type TransactionMutationArgs = { portfolio_id: string };

/** Any change to transactions recalculates positions and the portfolio summary. */
function invalidate_portfolio_data(portfolio_id: string) {
  return [
    { type: "Transaction" as const, id: portfolio_id },
    { type: "Position" as const, id: portfolio_id },
    { type: "Portfolio" as const, id: portfolio_id },
    { type: "Portfolio" as const, id: "LIST" },
  ];
}

export const transaction_api = base_api.injectEndpoints({
  endpoints: (build) => ({
    getTransactions: build.query<TransactionDto[], string>({
      query: (portfolio_id) => `/portfolios/${portfolio_id}/transactions`,
      providesTags: (_result, _error, portfolio_id) => [{ type: "Transaction", id: portfolio_id }],
    }),
    createTransaction: build.mutation<
      TransactionDto,
      TransactionMutationArgs & { body: TransactionRequest }
    >({
      query: ({ portfolio_id, body }) => ({
        url: `/portfolios/${portfolio_id}/transactions`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, error, { portfolio_id }) =>
        error ? [] : invalidate_portfolio_data(portfolio_id),
    }),
    updateTransaction: build.mutation<
      TransactionDto,
      TransactionMutationArgs & { transaction_id: string; body: Partial<TransactionRequest> }
    >({
      query: ({ portfolio_id, transaction_id, body }) => ({
        url: `/portfolios/${portfolio_id}/transactions/${transaction_id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, error, { portfolio_id }) =>
        error ? [] : invalidate_portfolio_data(portfolio_id),
    }),
    deleteTransaction: build.mutation<void, TransactionMutationArgs & { transaction_id: string }>({
      query: ({ portfolio_id, transaction_id }) => ({
        url: `/portfolios/${portfolio_id}/transactions/${transaction_id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, error, { portfolio_id }) =>
        error ? [] : invalidate_portfolio_data(portfolio_id),
    }),
  }),
});

export const {
  useGetTransactionsQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} = transaction_api;
