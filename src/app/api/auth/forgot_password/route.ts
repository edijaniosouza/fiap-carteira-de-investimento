import { json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { forgot_password_schema } from "@/lib/validators/auth_validators";
import { request_password_reset } from "@/services/auth_service";
import type { MessageResponse } from "@/types/api";

export const POST = with_error_handling(async (request) => {
  const input = await parse_json_body(request, forgot_password_schema);
  await request_password_reset(input.email);
  return json_ok<MessageResponse>({
    message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
  });
});
