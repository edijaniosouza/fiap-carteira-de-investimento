import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  user_id: string;
  email: string;
};

function get_secret_key(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be defined with at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function sign_session_token(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.user_id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(get_secret_key());
}

export async function verify_session_token(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, get_secret_key(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") {
      return null;
    }
    return { user_id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
