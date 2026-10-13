import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { Provider } from "react-redux";
import { vi } from "vitest";
import { make_store, type RootState } from "@/store/store";

export function render_with_store(ui: ReactElement, preloaded_state?: Partial<RootState>) {
  const store = make_store(preloaded_state);
  const result = render(<Provider store={store}>{ui}</Provider>);
  return { store, ...result };
}

type QueryState<T> = {
  data?: T;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
};

/** Return value of a mocked RTK Query query hook. */
export function query_result<T>(state: QueryState<T> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: undefined,
    refetch: vi.fn(),
    ...state,
  } as never;
}

type MutationState = {
  isLoading?: boolean;
  error?: unknown;
  data?: unknown;
};

/** Tuple returned by a mocked RTK Query mutation hook, plus handles to drive it. */
export function mutation_result(state: MutationState = {}) {
  const unwrap = vi.fn(async () => undefined as unknown);
  const trigger = vi.fn(() => ({ unwrap }));
  const reset = vi.fn();
  const tuple = [trigger, { isLoading: false, error: undefined, data: undefined, reset, ...state }] as never;
  return { trigger, unwrap, reset, tuple };
}

export const API_ERROR = { status: 422, data: { error: { code: "X", message: "Mensagem da API" } } };
