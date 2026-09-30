import { require_session, start_session } from "@/lib/auth/session";
import { json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { update_profile_schema } from "@/lib/validators/auth_validators";
import { get_user, update_profile } from "@/services/auth_service";

export const GET = with_error_handling(async () => {
  const session = await require_session();
  return json_ok(await get_user(session.user_id));
});

export const PATCH = with_error_handling(async (request) => {
  const session = await require_session();
  const input = await parse_json_body(request, update_profile_schema);
  const user = await update_profile(session.user_id, input);
  if (user.email !== session.email) {
    // The session token carries the e-mail, so it is re-issued after a change.
    await start_session({ user_id: user.id, email: user.email });
  }
  return json_ok(user);
});
