import { require_session } from "@/lib/auth/session";
import { json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { simulation_schema } from "@/lib/validators/portfolio_validators";
import { run_simulation } from "@/services/simulation_service";

export const POST = with_error_handling(async (request) => {
  await require_session();
  const input = await parse_json_body(request, simulation_schema);
  return json_ok(await run_simulation(input));
});
