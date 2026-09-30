import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verify_session_token } from "@/lib/auth/jwt";

// Optimistic session check. Route Handlers still call require_session().
const PUBLIC_API_PATHS = new Set([
  "/api/auth/sign_up",
  "/api/auth/sign_in",
  "/api/auth/forgot_password",
  "/api/auth/reset_password",
]);

const AUTH_PAGES = new Set(["/sign_in", "/sign_up", "/forgot_password", "/reset_password"]);

const HOME_PATH = "/dashboard";
const SIGN_IN_PATH = "/sign_in";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verify_session_token(token) : null;

  if (pathname.startsWith("/api/")) {
    if (session || PUBLIC_API_PATHS.has(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Não autenticado" } },
      { status: 401 },
    );
  }

  if (AUTH_PAGES.has(pathname)) {
    return session ? NextResponse.redirect(new URL(HOME_PATH, request.url)) : NextResponse.next();
  }

  if (!session) {
    const sign_in_url = new URL(SIGN_IN_PATH, request.url);
    if (pathname !== "/") {
      sign_in_url.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(sign_in_url);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(HOME_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
