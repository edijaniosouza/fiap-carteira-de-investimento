import { start_session } from "@/lib/auth/session";
import { json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { sign_in_schema } from "@/lib/validators/auth_validators";
import { sign_in } from "@/services/auth_service";

export const POST = with_error_handling(async (request) => {
  const input = await parse_json_body(request, sign_in_schema);
  const user = await sign_in(input);
  await start_session({ user_id: user.id, email: user.email });
  return json_ok(user);
});
