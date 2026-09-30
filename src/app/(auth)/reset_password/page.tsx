import type { Metadata } from "next";
import { ResetPasswordContainer } from "@/containers/auth/reset_password_container";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPasswordPage({ searchParams: search_params }: PageProps<"/reset_password">) {
  const { token } = await search_params;
  return <ResetPasswordContainer token={typeof token === "string" ? token : null} />;
}
