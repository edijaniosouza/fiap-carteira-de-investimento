import { describe, expect, it } from "vitest";
import {
  build_asset_summary_dto,
  build_transaction_dto,
  build_user_dto,
} from "../../support/factories";
import {
  CATALOG_PAGE_SIZE,
  catalog_filters_slice,
  filters_hydrated,
  group_changed,
  page_changed,
  query_changed,
  select_catalog_filters,
  type_changed,
} from "@/store/slices/catalog_filters_slice";
import {
  profile_updated,
  select_current_user,
  session_slice,
  session_started,
  signed_out,
} from "@/store/slices/session_slice";
import {
  select_simulator,
  simulation_asset_selected,
  simulation_params_changed,
  simulator_slice,
} from "@/store/slices/simulator_slice";
import {
  create_transaction_dialog_opened,
  deletion_dismissed,
  deletion_requested,
  edit_transaction_dialog_opened,
  portfolio_dialog_closed,
  portfolio_dialog_opened,
  purchase_requested,
  select_pending_deletion,
  select_pending_purchase_asset,
  select_portfolio_dialog,
  select_transaction_dialog,
  transaction_dialog_closed,
  ui_slice,
} from "@/store/slices/ui_slice";

describe("catalog_filters_slice", () => {
  const reducer = catalog_filters_slice.reducer;
  const initial_state = reducer(undefined, { type: "@@init" });

  it("starts on variable income, all types, first page", () => {
    expect(initial_state).toEqual({ group: "VARIABLE_INCOME", type: "ALL", q: "", page: 1, limit: CATALOG_PAGE_SIZE });
    expect(CATALOG_PAGE_SIZE).toBe(20);
  });

  it("hydrates partial filters", () => {
    expect(reducer(initial_state, filters_hydrated({ group: "FIXED_INCOME", page: 3 }))).toEqual({
      ...initial_state,
      group: "FIXED_INCOME",
      page: 3,
    });
  });

  it("resets type and page when the group changes", () => {
    const state = { ...initial_state, type: "FII" as const, page: 4 };
    expect(reducer(state, group_changed("FIXED_INCOME"))).toMatchObject({ group: "FIXED_INCOME", type: "ALL", page: 1 });
  });

  it("resets the page when type or query change", () => {
    const state = { ...initial_state, page: 4 };
    expect(reducer(state, type_changed("ETF"))).toMatchObject({ type: "ETF", page: 1 });
    expect(reducer(state, query_changed("petr"))).toMatchObject({ q: "petr", page: 1 });
  });

  it("never goes below page 1", () => {
    expect(reducer(initial_state, page_changed(5)).page).toBe(5);
    expect(reducer(initial_state, page_changed(0)).page).toBe(1);
    expect(reducer(initial_state, page_changed(-3)).page).toBe(1);
  });

  it("selects the filters", () => {
    expect(select_catalog_filters({ catalog_filters: initial_state })).toBe(initial_state);
  });
});

describe("session_slice", () => {
  const reducer = session_slice.reducer;
  const user = build_user_dto();

  it("starts without user", () => {
    expect(reducer(undefined, { type: "@@init" })).toEqual({ current_user: null });
  });

  it("stores the user on sign in and profile update and clears on sign out", () => {
    let state = reducer(undefined, session_started(user));
    expect(select_current_user({ session: state })).toEqual(user);

    state = reducer(state, profile_updated({ ...user, name: "Outra" }));
    expect(state.current_user?.name).toBe("Outra");

    state = reducer(state, signed_out());
    expect(select_current_user({ session: state })).toBeNull();
  });
});

describe("simulator_slice", () => {
  const reducer = simulator_slice.reducer;

  it("starts with default params", () => {
    expect(reducer(undefined, { type: "@@init" })).toEqual({ asset: null, amount: 1000, months: 12 });
  });

  it("selects an asset and updates params", () => {
    const asset = build_asset_summary_dto();
    let state = reducer(undefined, simulation_asset_selected(asset));
    state = reducer(state, simulation_params_changed({ amount: 5000, months: 24 }));

    expect(select_simulator({ simulator: state })).toEqual({ asset, amount: 5000, months: 24 });
    expect(reducer(state, simulation_asset_selected(null)).asset).toBeNull();
  });
});

describe("ui_slice", () => {
  const reducer = ui_slice.reducer;
  const initial_state = reducer(undefined, { type: "@@init" });
  const asset = build_asset_summary_dto();

  it("starts with everything closed", () => {
    expect(initial_state).toEqual({
      transaction_dialog: { is_open: false },
      pending_purchase_asset: null,
      pending_deletion: null,
      portfolio_dialog: { is_open: false, editing_portfolio_id: null },
    });
  });

  it("opens the create dialog consuming the pending purchase", () => {
    let state = reducer(initial_state, purchase_requested(asset));
    expect(select_pending_purchase_asset({ ui: state })).toEqual(asset);

    state = reducer(state, create_transaction_dialog_opened(asset));
    expect(select_transaction_dialog({ ui: state })).toEqual({ is_open: true, mode: "create", preset_asset: asset });
    expect(state.pending_purchase_asset).toBeNull();
  });

  it("opens the edit dialog and closes it", () => {
    const transaction = build_transaction_dto();
    let state = reducer(initial_state, edit_transaction_dialog_opened(transaction));
    expect(state.transaction_dialog).toEqual({ is_open: true, mode: "edit", transaction });

    state = reducer(state, transaction_dialog_closed());
    expect(state.transaction_dialog).toEqual({ is_open: false });
  });

  it("tracks pending deletions", () => {
    const deletion = { kind: "portfolio" as const, id: "p1", label: "Principal" };
    let state = reducer(initial_state, deletion_requested(deletion));
    expect(select_pending_deletion({ ui: state })).toEqual(deletion);

    state = reducer(state, deletion_dismissed());
    expect(state.pending_deletion).toBeNull();
  });

  it("opens the portfolio dialog for creation or edition and closes it", () => {
    let state = reducer(initial_state, portfolio_dialog_opened("p1"));
    expect(select_portfolio_dialog({ ui: state })).toEqual({ is_open: true, editing_portfolio_id: "p1" });

    state = reducer(state, portfolio_dialog_opened(null));
    expect(state.portfolio_dialog).toEqual({ is_open: true, editing_portfolio_id: null });

    state = reducer(state, portfolio_dialog_closed());
    expect(state.portfolio_dialog).toEqual({ is_open: false, editing_portfolio_id: null });
  });
});
