import { redirect } from "next/navigation";

// The proxy already redirects "/", this is a fallback.
export default function HomePage() {
  redirect("/dashboard");
}
