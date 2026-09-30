import type { Metadata } from "next";
import { SignInContainer } from "@/containers/auth/sign_in_container";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams: search_params }: PageProps<"/sign_in">) {
  const { next } = await search_params;
  return <SignInContainer next_path={typeof next === "string" ? next : null} />;
}
