import { json_ok, parse_json_body, with_error_handling } from "@/lib/http";
import { reset_password_schema } from "@/lib/validators/auth_validators";
import { reset_password } from "@/services/auth_service";
import type { MessageResponse } from "@/types/api";

export const POST = with_error_handling(async (request) => {
  const input = await parse_json_body(request, reset_password_schema);
  await reset_password(input);
  return json_ok<MessageResponse>({ message: "Senha redefinida com sucesso." });
});
