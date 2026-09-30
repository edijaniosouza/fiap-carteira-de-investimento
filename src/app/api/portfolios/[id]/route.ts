import { require_session } from "@/lib/auth/session";
import { json_no_content, json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { portfolio_schema } from "@/lib/validators/portfolio_validators";
import {
  delete_portfolio,
  get_portfolio_summary,
  rename_portfolio,
} from "@/services/portfolio_service";

type Context = RouteContext<"/api/portfolios/[id]">;

/** Consolidated view (dashboard) of the portfolio. */
export const GET = with_error_handling<Context>(async (_request, context) => {
  const session = await require_session();
  const { id } = await context.params;
  return json_ok(await get_portfolio_summary(session.user_id, id));
});

export const PATCH = with_error_handling<Context>(async (request, context) => {
  const session = await require_session();
  const { id } = await context.params;
  const input = await parse_json_body(request, portfolio_schema);
  return json_ok(await rename_portfolio(session.user_id, id, input));
});

export const DELETE = with_error_handling<Context>(async (_request, context) => {
  const session = await require_session();
  const { id } = await context.params;
  await delete_portfolio(session.user_id, id);
  return json_no_content();
});
