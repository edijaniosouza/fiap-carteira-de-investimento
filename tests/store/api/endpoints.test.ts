import { beforeEach, describe, expect, it } from "vitest";
import {
  build_portfolio_dto,
  build_summary_dto,
  build_transaction_dto,
  build_user_dto,
} from "../../support/factories";
import { type FetchMock, json_response, requested, requested_paths, stub_fetch } from "../../support/store_helpers";
import { auth_api } from "@/store/api/auth_api";
import { catalog_api } from "@/store/api/catalog_api";
import { portfolio_api } from "@/store/api/portfolio_api";
import { quote_api } from "@/store/api/quote_api";
import { simulation_api } from "@/store/api/simulation_api";
import { transaction_api } from "@/store/api/transaction_api";
import { make_store } from "@/store/store";

type Route = { method: string; path: string; status?: number; body?: unknown };

/** Answers each request with the first matching route (method + pathname). */
function route_fetch(fetch_mock: FetchMock, routes: Route[]) {
  fetch_mock.mockImplementation(async (request) => {
    const pathname = new URL(request.url).pathname;
    const route = routes.find((item) => item.method === request.method && item.path === pathname);
    if (!route) {
      return json_response({ error: { code: "NOT_FOUND", message: pathname } }, 404);
    }
    return json_response(route.body, route.status ?? 200);
  });
}

async function body_of(fetch_mock: FetchMock, index = 0): Promise<unknown> {
  return requested(fetch_mock, index).clone().json();
}

describe("RTK Query endpoints", () => {
  let fetch_mock: FetchMock;
  let store: ReturnType<typeof make_store>;

  beforeEach(() => {
    fetch_mock = stub_fetch();
    store = make_store();
  });

  describe("auth_api", () => {
    const user = build_user_dto();

    it.each([
      ["signUp", { name: "Maria", email: "m@x.com", password: "12345678" }, "/api/auth/sign_up"],
      ["signIn", { email: "m@x.com", password: "x" }, "/api/auth/sign_in"],
      ["forgotPassword", { email: "m@x.com" }, "/api/auth/forgot_password"],
      ["resetPassword", { token: "t", password: "12345678" }, "/api/auth/reset_password"],
    ] as const)("%s posts the body", async (endpoint, body, path) => {
      route_fetch(fetch_mock, [{ method: "POST", path, body: user }]);

      // Each endpoint has its own argument type; the table keeps them aligned.
      const initiate = auth_api.endpoints[endpoint].initiate as unknown as (
        arg: typeof body,
      ) => ReturnType<typeof auth_api.endpoints.signIn.initiate>;
      const result = await store.dispatch(initiate(body));

      expect(result.data).toEqual(user);
      expect(requested_paths(fetch_mock)).toEqual([`POST ${path}`]);
      expect(await body_of(fetch_mock)).toEqual(body);
    });

    it("signOut posts without body", async () => {
      route_fetch(fetch_mock, [{ method: "POST", path: "/api/auth/sign_out", status: 204 }]);
      await store.dispatch(auth_api.endpoints.signOut.initiate());
      expect(requested_paths(fetch_mock)).toEqual(["POST /api/auth/sign_out"]);
    });

    it("updateProfile invalidates the profile query", async () => {
      route_fetch(fetch_mock, [
        { method: "GET", path: "/api/auth/profile", body: user },
        { method: "PATCH", path: "/api/auth/profile", body: user },
      ]);
      const subscription = store.dispatch(auth_api.endpoints.getProfile.initiate());
      await subscription;

      await store.dispatch(auth_api.endpoints.updateProfile.initiate({ name: "Nova" }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(requested_paths(fetch_mock)).toEqual([
        "GET /api/auth/profile",
        "PATCH /api/auth/profile",
        "GET /api/auth/profile",
      ]);
      expect(await body_of(fetch_mock, 1)).toEqual({ name: "Nova" });
      subscription.unsubscribe();
    });
  });

  it("catalog_api sends filters as query params", async () => {
    route_fetch(fetch_mock, [
      { method: "GET", path: "/api/catalog", body: { items: [], page: 1, limit: 20, total: 0, total_pages: 1 } },
    ]);

    await store.dispatch(catalog_api.endpoints.getCatalog.initiate({ type: "STOCK,FII", q: "petr", page: 2, limit: 20 }));

    const url = new URL(requested(fetch_mock).url);
    expect(url.pathname).toBe("/api/catalog");
    expect(Object.fromEntries(url.searchParams)).toEqual({ type: "STOCK,FII", q: "petr", page: "2", limit: "20" });
  });

  it("quote_api fetches the asset quote", async () => {
    route_fetch(fetch_mock, [{ method: "GET", path: "/api/quotes/asset_1", body: { value: 35 } }]);
    const result = await store.dispatch(quote_api.endpoints.getQuote.initiate("asset_1"));
    expect(result.data).toEqual({ value: 35 });
  });

  it("simulation_api posts the simulation request", async () => {
    route_fetch(fetch_mock, [{ method: "POST", path: "/api/simulations", body: { kind: "FIXED_INCOME" } }]);
    await store.dispatch(simulation_api.endpoints.runSimulation.initiate({ asset_id: "a", amount: 1000, months: 12 }));
    expect(await body_of(fetch_mock)).toEqual({ asset_id: "a", amount: 1000, months: 12 });
  });

  describe("portfolio_api", () => {
    const list = { items: [build_portfolio_dto()], plan: { max_portfolios: 1, can_create: false } };

    beforeEach(() => {
      route_fetch(fetch_mock, [
        { method: "GET", path: "/api/portfolios", body: list },
        { method: "POST", path: "/api/portfolios", status: 201, body: build_portfolio_dto() },
        { method: "GET", path: "/api/portfolios/portfolio_1", body: build_summary_dto() },
        { method: "PATCH", path: "/api/portfolios/portfolio_1", body: build_portfolio_dto() },
        { method: "DELETE", path: "/api/portfolios/portfolio_1", status: 204 },
        { method: "GET", path: "/api/portfolios/portfolio_1/positions", body: [] },
      ]);
    });

    async function flush() {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    it("createPortfolio refetches the list", async () => {
      const subscription = store.dispatch(portfolio_api.endpoints.getPortfolios.initiate());
      await subscription;

      await store.dispatch(portfolio_api.endpoints.createPortfolio.initiate({ name: "Nova" }));
      await flush();

      expect(requested_paths(fetch_mock)).toEqual(["GET /api/portfolios", "POST /api/portfolios", "GET /api/portfolios"]);
      subscription.unsubscribe();
    });

    it("renamePortfolio refetches list and summary", async () => {
      const list_subscription = store.dispatch(portfolio_api.endpoints.getPortfolios.initiate());
      const summary_subscription = store.dispatch(portfolio_api.endpoints.getPortfolioSummary.initiate("portfolio_1"));
      await Promise.all([list_subscription, summary_subscription]);

      await store.dispatch(
        portfolio_api.endpoints.renamePortfolio.initiate({ portfolio_id: "portfolio_1", body: { name: "Nova" } }),
      );
      await flush();

      expect(requested_paths(fetch_mock).slice(2).sort()).toEqual([
        "GET /api/portfolios",
        "GET /api/portfolios/portfolio_1",
        "PATCH /api/portfolios/portfolio_1",
      ]);
      list_subscription.unsubscribe();
      summary_subscription.unsubscribe();
    });

    it("deletePortfolio invalidates positions too", async () => {
      const positions_subscription = store.dispatch(portfolio_api.endpoints.getPositions.initiate("portfolio_1"));
      await positions_subscription;

      await store.dispatch(portfolio_api.endpoints.deletePortfolio.initiate("portfolio_1"));
      await flush();

      expect(requested_paths(fetch_mock)).toEqual([
        "GET /api/portfolios/portfolio_1/positions",
        "DELETE /api/portfolios/portfolio_1",
        "GET /api/portfolios/portfolio_1/positions",
      ]);
      positions_subscription.unsubscribe();
    });
  });

  describe("transaction_api", () => {
    const base = "/api/portfolios/portfolio_1/transactions";

    async function flush() {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    function subscribe_all() {
      return [
        store.dispatch(transaction_api.endpoints.getTransactions.initiate("portfolio_1")),
        store.dispatch(portfolio_api.endpoints.getPortfolioSummary.initiate("portfolio_1")),
      ];
    }

    it.each([
      ["createTransaction", "POST", base],
      ["updateTransaction", "PATCH", `${base}/transaction_1`],
      ["deleteTransaction", "DELETE", `${base}/transaction_1`],
    ] as const)("%s refetches transactions and summary on success", async (endpoint, method, path) => {
      route_fetch(fetch_mock, [
        { method: "GET", path: base, body: [build_transaction_dto()] },
        { method: "GET", path: "/api/portfolios/portfolio_1", body: build_summary_dto() },
        { method, path, body: method === "DELETE" ? undefined : build_transaction_dto(), status: method === "DELETE" ? 204 : 200 },
      ]);
      const subscriptions = subscribe_all();
      await Promise.all(subscriptions);

      const body = { asset_id: "asset_1", type: "BUY", quantity: 1, unit_price: 10, trade_date: "2026-03-01" };
      const initiate = transaction_api.endpoints[endpoint].initiate as unknown as (arg: {
        portfolio_id: string;
        transaction_id: string;
        body: typeof body;
      }) => ReturnType<typeof transaction_api.endpoints.deleteTransaction.initiate>;
      await store.dispatch(initiate({ portfolio_id: "portfolio_1", transaction_id: "transaction_1", body }));
      await flush();

      const calls = requested_paths(fetch_mock);
      expect(calls[2]).toBe(`${method} ${path}`);
      expect(calls.slice(3).sort()).toEqual(["GET /api/portfolios/portfolio_1", `GET ${base}`]);
      if (method !== "DELETE") {
        expect(await body_of(fetch_mock, 2)).toEqual(body);
      }
      subscriptions.forEach((subscription) => subscription.unsubscribe());
    });

    it("does not invalidate anything when the mutation fails", async () => {
      route_fetch(fetch_mock, [
        { method: "GET", path: base, body: [] },
        { method: "GET", path: "/api/portfolios/portfolio_1", body: build_summary_dto() },
        { method: "POST", path: base, status: 422, body: { error: { code: "NEGATIVE_BALANCE", message: "x" } } },
        { method: "PATCH", path: `${base}/t1`, status: 422, body: { error: { code: "NEGATIVE_BALANCE", message: "x" } } },
        { method: "DELETE", path: `${base}/t1`, status: 422, body: { error: { code: "NEGATIVE_BALANCE", message: "x" } } },
      ]);
      const subscriptions = subscribe_all();
      await Promise.all(subscriptions);

      const body = { asset_id: "a", type: "SELL" as const, quantity: 1, unit_price: 1, trade_date: "2026-03-01" };
      await store.dispatch(transaction_api.endpoints.createTransaction.initiate({ portfolio_id: "portfolio_1", body }));
      await store.dispatch(
        transaction_api.endpoints.updateTransaction.initiate({ portfolio_id: "portfolio_1", transaction_id: "t1", body }),
      );
      await store.dispatch(
        transaction_api.endpoints.deleteTransaction.initiate({ portfolio_id: "portfolio_1", transaction_id: "t1" }),
      );
      await flush();

      expect(fetch_mock).toHaveBeenCalledTimes(5);
      subscriptions.forEach((subscription) => subscription.unsubscribe());
    });
  });
});
