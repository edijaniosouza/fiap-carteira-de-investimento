import "server-only";
import { cookies } from "next/headers";
import { unauthorized_error } from "@/lib/errors";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type SessionPayload,
  sign_session_token,
  verify_session_token,
} from "@/lib/auth/jwt";

export async function get_session(): Promise<SessionPayload | null> {
  const cookie_store = await cookies();
  const token = cookie_store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verify_session_token(token);
}

export async function require_session(): Promise<SessionPayload> {
  const session = await get_session();
  if (!session) {
    throw unauthorized_error();
  }
  return session;
}

export async function start_session(payload: SessionPayload): Promise<void> {
  const token = await sign_session_token(payload);
  const cookie_store = await cookies();
  cookie_store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function end_session(): Promise<void> {
  const cookie_store = await cookies();
  cookie_store.delete(SESSION_COOKIE_NAME);
}
