import { require_session } from "@/lib/auth/session";
import { json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { transaction_schema } from "@/lib/validators/portfolio_validators";
import { create_transaction, list_transactions } from "@/services/transaction_service";

type Context = RouteContext<"/api/portfolios/[id]/transactions">;

export const GET = with_error_handling<Context>(async (_request, context) => {
  const session = await require_session();
  const { id } = await context.params;
  return json_ok(await list_transactions(session.user_id, id));
});

export const POST = with_error_handling<Context>(async (request, context) => {
  const session = await require_session();
  const { id } = await context.params;
  const input = await parse_json_body(request, transaction_schema);
  return json_ok(await create_transaction(session.user_id, id, input), 201);
});
