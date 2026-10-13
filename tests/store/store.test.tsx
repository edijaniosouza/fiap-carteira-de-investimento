/** @vitest-environment jsdom */
import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { build_user_dto } from "../support/factories";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks";
import { select_current_user, signed_out } from "@/store/slices/session_slice";
import { make_store } from "@/store/store";
import { StoreProvider } from "@/store/store_provider";

describe("make_store", () => {
  it("combines api and slices with default state", () => {
    const state = make_store().getState();
    expect(Object.keys(state).sort()).toEqual(["api", "catalog_filters", "session", "simulator", "ui"]);
    expect(state.session.current_user).toBeNull();
  });

  it("accepts a preloaded session", () => {
    const user = build_user_dto();
    expect(make_store({ session: { current_user: user } }).getState().session.current_user).toEqual(user);
  });
});

describe("store hooks", () => {
  it("expose typed dispatch, selector and store", () => {
    const store = make_store({ session: { current_user: build_user_dto() } });
    const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

    const { result } = renderHook(
      () => ({ dispatch: useAppDispatch(), user: useAppSelector(select_current_user), store: useAppStore() }),
      { wrapper },
    );

    expect(result.current.store).toBe(store);
    expect(result.current.user?.name).toBe("Maria Silva");
    result.current.dispatch(signed_out());
    expect(store.getState().session.current_user).toBeNull();
  });
});

describe("StoreProvider", () => {
  function CurrentUserName() {
    const user = useAppSelector(select_current_user);
    return <span>{user?.name ?? "anônimo"}</span>;
  }

  it("hydrates the store with the server session", () => {
    render(
      <StoreProvider current_user={build_user_dto()}>
        <CurrentUserName />
      </StoreProvider>,
    );
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
  });

  it("works without user", () => {
    render(
      <StoreProvider current_user={null}>
        <CurrentUserName />
      </StoreProvider>,
    );
    expect(screen.getByText("anônimo")).toBeInTheDocument();
  });
});
