import type { Metadata } from "next";
import { ForgotPasswordContainer } from "@/containers/auth/forgot_password_container";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordContainer />;
}
