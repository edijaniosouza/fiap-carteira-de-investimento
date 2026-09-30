import { require_session } from "@/lib/auth/session";
import { json_no_content, json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { transaction_update_schema } from "@/lib/validators/portfolio_validators";
import { delete_transaction, update_transaction } from "@/services/transaction_service";

type Context = RouteContext<"/api/portfolios/[id]/transactions/[transaction_id]">;

export const PATCH = with_error_handling<Context>(async (request, context) => {
  const session = await require_session();
  const { id, transaction_id } = await context.params;
  const input = await parse_json_body(request, transaction_update_schema);
  return json_ok(await update_transaction(session.user_id, id, transaction_id, input));
});

export const DELETE = with_error_handling<Context>(async (_request, context) => {
  const session = await require_session();
  const { id, transaction_id } = await context.params;
  await delete_transaction(session.user_id, id, transaction_id);
  return json_no_content();
});
