import { NextRequest } from "next/server";

export function json_request(path: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

export function get_request(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

/** Next.js passes dynamic params as a promise. */
export function route_context<P extends Record<string, string>>(params: P) {
  // Cast: the generated RouteContext types are only available after `next typegen`.
  return { params: Promise.resolve(params) } as never;
}

export const SESSION = { user_id: "user_1", email: "maria@example.com" };
