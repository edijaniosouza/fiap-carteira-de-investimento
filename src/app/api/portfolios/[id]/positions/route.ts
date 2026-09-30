import { require_session } from "@/lib/auth/session";
import { json_ok, with_error_handling } from "@/lib/http";
import { get_positions } from "@/services/portfolio_service";

type Context = RouteContext<"/api/portfolios/[id]/positions">;

export const GET = with_error_handling<Context>(async (_request, context) => {
  const session = await require_session();
  const { id } = await context.params;
  return json_ok(await get_positions(session.user_id, id));
});
