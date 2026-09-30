import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AssetType } from "@/types/api";

export type CatalogGroup = "VARIABLE_INCOME" | "FIXED_INCOME";

export type CatalogFiltersState = {
  group: CatalogGroup;
  /** Specific asset type inside the group, or ALL. */
  type: AssetType | "ALL";
  q: string;
  page: number;
  limit: number;
};

export const CATALOG_PAGE_SIZE = 20;

const initial_state: CatalogFiltersState = {
  group: "VARIABLE_INCOME",
  type: "ALL",
  q: "",
  page: 1,
  limit: CATALOG_PAGE_SIZE,
};

export const catalog_filters_slice = createSlice({
  name: "catalog_filters",
  initialState: initial_state,
  reducers: {
    filters_hydrated(state, action: PayloadAction<Partial<CatalogFiltersState>>) {
      return { ...state, ...action.payload };
    },
    group_changed(state, action: PayloadAction<CatalogGroup>) {
      state.group = action.payload;
      state.type = "ALL";
      state.page = 1;
    },
    type_changed(state, action: PayloadAction<AssetType | "ALL">) {
      state.type = action.payload;
      state.page = 1;
    },
    query_changed(state, action: PayloadAction<string>) {
      state.q = action.payload;
      state.page = 1;
    },
    page_changed(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
    },
  },
  selectors: {
    select_catalog_filters: (state) => state,
  },
});

export const { filters_hydrated, group_changed, type_changed, query_changed, page_changed } =
  catalog_filters_slice.actions;
export const { select_catalog_filters } = catalog_filters_slice.selectors;
