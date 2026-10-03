/**
 * Erreur métier. Le code est stable (utilisable par les clients mobiles),
 * le message est destiné à l'utilisateur final (français).
 */
export type DomainErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_STATE"
  | "CAPACITY_EXCEEDED"
  | "PAYMENT_ERROR";

const HTTP_STATUS: Record<DomainErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INVALID_STATE: 409,
  CAPACITY_EXCEEDED: 409,
  PAYMENT_ERROR: 402,
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }
}

export function invariant(condition: unknown, message: string, code: DomainErrorCode = "VALIDATION"): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
