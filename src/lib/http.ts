import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import { AppError } from "@/lib/errors";
import type { ApiErrorBody } from "@/types/api";

export function json_ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function json_no_content(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function json_error(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function handle_route_error(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    return json_error(error.status, error.code, error.message, error.details);
  }
  if (error instanceof ZodError) {
    return json_error(400, "VALIDATION_ERROR", "Dados inválidos", z.flattenError(error).fieldErrors);
  }
  console.error("[api] unexpected error", error);
  return json_error(500, "INTERNAL_ERROR", "Erro interno do servidor");
}

type RouteHandler<C> = (request: NextRequest, context: C) => Promise<Response>;

export function with_error_handling<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handle_route_error(error);
    }
  };
}

export async function parse_json_body<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "Corpo da requisição deve ser um JSON válido");
  }
  return schema.parse(body);
}

export function parse_search_params<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
): z.infer<S> {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
}
