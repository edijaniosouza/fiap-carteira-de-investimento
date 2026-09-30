import type { ReactNode } from "react";
import Link from "next/link";
import { WalletIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthCardProps = {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
};

type AuthFooterLinkProps = {
  prompt?: string;
  href: string;
  label: string;
};

export function AuthFooterLink({ prompt, href, label }: AuthFooterLinkProps) {
  return (
    <span className="text-muted-foreground">
      {prompt && `${prompt} `}
      <Link href={href} className="text-foreground underline-offset-4 hover:underline">
        {label}
      </Link>
    </span>
  );
}

export function AuthCard({ title, description, footer, children }: AuthCardProps) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold">
          <WalletIcon className="size-5" />
          Minha Carteira
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer && <CardFooter className="justify-center text-sm">{footer}</CardFooter>}
        </Card>
      </div>
    </div>
  );
}
