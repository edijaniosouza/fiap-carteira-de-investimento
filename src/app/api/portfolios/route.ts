import { require_session } from "@/lib/auth/session";
import { json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { portfolio_schema } from "@/lib/validators/portfolio_validators";
import { create_portfolio, list_portfolios } from "@/services/portfolio_service";

export const GET = with_error_handling(async () => {
  const session = await require_session();
  return json_ok(await list_portfolios(session.user_id));
});

export const POST = with_error_handling(async (request) => {
  const session = await require_session();
  const input = await parse_json_body(request, portfolio_schema);
  return json_ok(await create_portfolio(session.user_id, input), 201);
});
