export type AppErrorCode =
  | "BAD_REQUEST"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "INVALID_TOKEN"
  | "FORBIDDEN"
  | "PLAN_LIMIT_REACHED"
  | "NOT_FOUND"
  | "EMAIL_IN_USE"
  | "NEGATIVE_BALANCE"
  | "QUOTE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly status: number;
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function not_found_error(message = "Recurso não encontrado"): AppError {
  return new AppError(404, "NOT_FOUND", message);
}

export function unauthorized_error(message = "Não autenticado"): AppError {
  return new AppError(401, "UNAUTHORIZED", message);
}
