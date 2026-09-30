import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { base_api } from "@/store/api/base_api";
import { catalog_filters_slice } from "@/store/slices/catalog_filters_slice";
import { session_slice } from "@/store/slices/session_slice";
import { simulator_slice } from "@/store/slices/simulator_slice";
import { ui_slice } from "@/store/slices/ui_slice";

const root_reducer = combineSlices(
  base_api,
  session_slice,
  ui_slice,
  catalog_filters_slice,
  simulator_slice,
);

export type RootState = ReturnType<typeof root_reducer>;

/** One store per request/browser session (official RTK + App Router pattern). */
export function make_store(preloaded_state?: Partial<RootState>) {
  return configureStore({
    reducer: root_reducer,
    preloadedState: preloaded_state,
    middleware: (get_default_middleware) => get_default_middleware().concat(base_api.middleware),
  });
}

export type AppStore = ReturnType<typeof make_store>;
export type AppDispatch = AppStore["dispatch"];
