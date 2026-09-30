import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { get_session } from "@/lib/auth/session";
import { find_user } from "@/services/auth_service";
import { StoreProvider } from "@/store/store_provider";
import "./globals.css";

const geist_sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geist_mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Minha Carteira",
    template: "%s · Minha Carteira",
  },
  description: "Gestão de investimentos pessoais: carteiras, transações e simulações.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await get_session();
  const current_user = session ? await find_user(session.user_id) : null;

  return (
    <html lang="pt-BR" className={`${geist_sans.variable} ${geist_mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <StoreProvider current_user={current_user}>{children}</StoreProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
