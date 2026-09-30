import { require_session } from "@/lib/auth/session";
import { json_ok, parse_search_params, with_error_handling } from "@/lib/http";
import { catalog_query_schema } from "@/lib/validators/portfolio_validators";
import { search_assets } from "@/services/catalog_service";

export const GET = with_error_handling(async (request) => {
  await require_session();
  const query = parse_search_params(request, catalog_query_schema);
  return json_ok(await search_assets(query));
});
