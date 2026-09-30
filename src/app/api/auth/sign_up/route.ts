import { start_session } from "@/lib/auth/session";
import { json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { sign_up_schema } from "@/lib/validators/auth_validators";
import { sign_up } from "@/services/auth_service";

export const POST = with_error_handling(async (request) => {
  const input = await parse_json_body(request, sign_up_schema);
  const user = await sign_up(input);
  await start_session({ user_id: user.id, email: user.email });
  return json_ok(user, 201);
});
