import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  build_portfolio_dto,
  build_position_dto,
  build_summary_dto,
  build_transaction_dto,
} from "../../support/factories";
import { get_request, json_request, route_context, SESSION } from "../../support/route_helpers";

vi.mock("@/lib/auth/session", () => ({ require_session: vi.fn() }));
vi.mock("@/services/portfolio_service", () => ({
  list_portfolios: vi.fn(),
  create_portfolio: vi.fn(),
  get_portfolio_summary: vi.fn(),
  rename_portfolio: vi.fn(),
  delete_portfolio: vi.fn(),
  get_positions: vi.fn(),
}));
vi.mock("@/services/transaction_service", () => ({
  list_transactions: vi.fn(),
  create_transaction: vi.fn(),
  update_transaction: vi.fn(),
  delete_transaction: vi.fn(),
}));

import {
  DELETE as portfolio_delete,
  GET as portfolio_get,
  PATCH as portfolio_patch,
} from "@/app/api/portfolios/[id]/route";
import { GET as positions_get } from "@/app/api/portfolios/[id]/positions/route";
import {
  DELETE as transaction_delete,
  PATCH as transaction_patch,
} from "@/app/api/portfolios/[id]/transactions/[transaction_id]/route";
import {
  GET as transactions_get,
  POST as transactions_post,
} from "@/app/api/portfolios/[id]/transactions/route";
import { GET as portfolios_get, POST as portfolios_post } from "@/app/api/portfolios/route";
import { require_session } from "@/lib/auth/session";
import { AppError, unauthorized_error } from "@/lib/errors";
import {
  create_portfolio,
  delete_portfolio,
  get_portfolio_summary,
  get_positions,
  list_portfolios,
  rename_portfolio,
} from "@/services/portfolio_service";
import {
  create_transaction,
  delete_transaction,
  list_transactions,
  update_transaction,
} from "@/services/transaction_service";

const portfolio_context = route_context({ id: "portfolio_1" });
const transaction_context = route_context({ id: "portfolio_1", transaction_id: "transaction_1" });

describe("portfolio routes", () => {
  beforeEach(() => {
    vi.mocked(require_session).mockResolvedValue(SESSION);
  });

  describe("/api/portfolios", () => {
    it("GET lists the user's portfolios", async () => {
      const list = { items: [build_portfolio_dto()], plan: { max_portfolios: 1, can_create: false } };
      vi.mocked(list_portfolios).mockResolvedValue(list);

      const response = await portfolios_get(get_request("/api/portfolios"), route_context({}));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(list);
      expect(list_portfolios).toHaveBeenCalledWith("user_1");
    });

    it("GET answers 401 without session", async () => {
      vi.mocked(require_session).mockRejectedValue(unauthorized_error());
      const response = await portfolios_get(get_request("/api/portfolios"), route_context({}));
      expect(response.status).toBe(401);
      expect(list_portfolios).not.toHaveBeenCalled();
    });

    it("POST creates a portfolio with 201", async () => {
      vi.mocked(create_portfolio).mockResolvedValue(build_portfolio_dto());

      const response = await portfolios_post(
        json_request("/api/portfolios", "POST", { name: " Principal " }),
        route_context({}),
      );

      expect(response.status).toBe(201);
      expect(create_portfolio).toHaveBeenCalledWith("user_1", { name: "Principal" });
    });

    it("POST forwards the plan limit error", async () => {
      vi.mocked(create_portfolio).mockRejectedValue(new AppError(403, "PLAN_LIMIT_REACHED", "Limite"));

      const response = await portfolios_post(json_request("/api/portfolios", "POST", { name: "X" }), route_context({}));

      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("PLAN_LIMIT_REACHED");
    });
  });

  describe("/api/portfolios/[id]", () => {
    it("GET returns the summary", async () => {
      const summary = build_summary_dto();
      vi.mocked(get_portfolio_summary).mockResolvedValue(summary);

      const response = await portfolio_get(get_request("/api/portfolios/portfolio_1"), portfolio_context);

      expect(await response.json()).toEqual(summary);
      expect(get_portfolio_summary).toHaveBeenCalledWith("user_1", "portfolio_1");
    });

    it("PATCH renames the portfolio", async () => {
      vi.mocked(rename_portfolio).mockResolvedValue(build_portfolio_dto({ name: "Nova" }));

      const response = await portfolio_patch(
        json_request("/api/portfolios/portfolio_1", "PATCH", { name: "Nova" }),
        portfolio_context,
      );

      expect(response.status).toBe(200);
      expect(rename_portfolio).toHaveBeenCalledWith("user_1", "portfolio_1", { name: "Nova" });
    });

    it("PATCH validates the name", async () => {
      const response = await portfolio_patch(
        json_request("/api/portfolios/portfolio_1", "PATCH", { name: "" }),
        portfolio_context,
      );
      expect(response.status).toBe(400);
      expect(rename_portfolio).not.toHaveBeenCalled();
    });

    it("DELETE removes the portfolio with 204", async () => {
      const response = await portfolio_delete(
        json_request("/api/portfolios/portfolio_1", "DELETE"),
        portfolio_context,
      );
      expect(response.status).toBe(204);
      expect(delete_portfolio).toHaveBeenCalledWith("user_1", "portfolio_1");
    });
  });

  it("GET /api/portfolios/[id]/positions returns positions", async () => {
    const positions = [build_position_dto()];
    vi.mocked(get_positions).mockResolvedValue(positions);

    const response = await positions_get(get_request("/api/portfolios/portfolio_1/positions"), portfolio_context);

    expect(await response.json()).toEqual(positions);
    expect(get_positions).toHaveBeenCalledWith("user_1", "portfolio_1");
  });

  describe("/api/portfolios/[id]/transactions", () => {
    it("GET lists transactions", async () => {
      vi.mocked(list_transactions).mockResolvedValue([build_transaction_dto()]);

      const response = await transactions_get(
        get_request("/api/portfolios/portfolio_1/transactions"),
        portfolio_context,
      );

      expect(response.status).toBe(200);
      expect(list_transactions).toHaveBeenCalledWith("user_1", "portfolio_1");
    });

    it("POST creates a transaction with 201", async () => {
      vi.mocked(create_transaction).mockResolvedValue(build_transaction_dto());
      const body = { asset_id: "asset_1", type: "BUY", quantity: 10, unit_price: 30, trade_date: "2026-03-01" };

      const response = await transactions_post(
        json_request("/api/portfolios/portfolio_1/transactions", "POST", body),
        portfolio_context,
      );

      expect(response.status).toBe(201);
      expect(create_transaction).toHaveBeenCalledWith("user_1", "portfolio_1", body);
    });

    it("POST forwards negative balance errors as 422", async () => {
      vi.mocked(create_transaction).mockRejectedValue(new AppError(422, "NEGATIVE_BALANCE", "Saldo negativo"));
      const body = { asset_id: "asset_1", type: "SELL", quantity: 10, unit_price: 30, trade_date: "2026-03-01" };

      const response = await transactions_post(
        json_request("/api/portfolios/portfolio_1/transactions", "POST", body),
        portfolio_context,
      );

      expect(response.status).toBe(422);
    });
  });

  describe("/api/portfolios/[id]/transactions/[transaction_id]", () => {
    it("PATCH updates with a partial payload", async () => {
      vi.mocked(update_transaction).mockResolvedValue(build_transaction_dto({ quantity: 2 }));

      const response = await transaction_patch(
        json_request("/api/portfolios/portfolio_1/transactions/transaction_1", "PATCH", { quantity: "2" }),
        transaction_context,
      );

      expect(response.status).toBe(200);
      expect(update_transaction).toHaveBeenCalledWith("user_1", "portfolio_1", "transaction_1", { quantity: 2 });
    });

    it("DELETE removes the transaction with 204", async () => {
      const response = await transaction_delete(
        json_request("/api/portfolios/portfolio_1/transactions/transaction_1", "DELETE"),
        transaction_context,
      );

      expect(response.status).toBe(204);
      expect(delete_transaction).toHaveBeenCalledWith("user_1", "portfolio_1", "transaction_1");
    });
  });
});
