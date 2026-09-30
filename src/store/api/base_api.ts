import {
  type BaseQueryFn,
  createApi,
  type FetchArgs,
  fetchBaseQuery,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { signed_out } from "@/store/slices/session_slice";
import type { ApiErrorBody } from "@/types/api";

const SIGN_IN_PATH = "/sign_in";

const raw_base_query = fetchBaseQuery({ baseUrl: "/api", credentials: "same-origin" });

function is_api_error_body(data: unknown): data is ApiErrorBody {
  return typeof data === "object" && data !== null && "error" in data;
}

/** Expired/missing session: clear client state and send the user to sign in. */
const base_query_with_session: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extra_options,
) => {
  const result = await raw_base_query(args, api, extra_options);
  const error_code = is_api_error_body(result.error?.data) ? result.error.data.error.code : null;
  if (result.error?.status === 401 && error_code === "UNAUTHORIZED") {
    api.dispatch(signed_out());
    if (typeof window !== "undefined" && window.location.pathname !== SIGN_IN_PATH) {
      // Full reload on purpose: drops every in-memory state of the expired session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(SIGN_IN_PATH);
    }
  }
  return result;
};

export const base_api = createApi({
  reducerPath: "api",
  baseQuery: base_query_with_session,
  tagTypes: ["Portfolio", "Transaction", "Position", "Catalog", "Quote", "Profile"],
  endpoints: () => ({}),
});

/** Extracts the user-facing message from an RTK Query error. */
export function get_error_message(error: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (is_api_error_body(data)) {
      return data.error.message;
    }
  }
  return fallback;
}

/** Field errors returned by the API on validation failures (400). */
export function get_field_errors(error: unknown): Record<string, string[]> {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (is_api_error_body(data) && typeof data.error.details === "object" && data.error.details) {
      return data.error.details as Record<string, string[]>;
    }
  }
  return {};
}
