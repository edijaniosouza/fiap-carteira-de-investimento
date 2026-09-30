import { end_session } from "@/lib/auth/session";
import { json_no_content, with_error_handling } from "@/lib/http";

export const POST = with_error_handling(async () => {
  await end_session();
  return json_no_content();
});
