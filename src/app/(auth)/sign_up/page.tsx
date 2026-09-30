import type { Metadata } from "next";
import { SignUpContainer } from "@/containers/auth/sign_up_container";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return <SignUpContainer />;
}
