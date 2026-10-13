import { type Mock, vi } from "vitest";

export type FetchMock = Mock<(request: Request) => Promise<Response>>;

export function json_response(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * RTK Query builds `new Request("/api/...")`. Node's Request only accepts absolute URLs,
 * so relative ones are resolved against localhost before reaching the mocked fetch.
 */
export function stub_fetch(): FetchMock {
  const fetch_mock: FetchMock = vi.fn();
  const NativeRequest = globalThis.Request;
  class RelativeRequest extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === "string" ? new URL(input, "http://localhost") : input, init);
    }
  }
  vi.stubGlobal("Request", RelativeRequest);
  vi.stubGlobal("fetch", fetch_mock);
  return fetch_mock;
}

export function requested(fetch_mock: FetchMock, index = 0): Request {
  return fetch_mock.mock.calls[index][0];
}

export function requested_paths(fetch_mock: FetchMock): string[] {
  return fetch_mock.mock.calls.map(([request]) => {
    const url = new URL(request.url);
    return `${request.method} ${url.pathname}${url.search}`;
  });
}
