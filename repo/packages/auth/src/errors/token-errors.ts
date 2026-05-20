/**
 * @insurtech/auth/errors/token-errors
 *
 * Strongly typed error hierarchy for JWT verification failures.
 * Consumed by JwtService.verify*, JwtStrategy, AuthController.
 */

export class TokenError extends Error {
  readonly code: string;
  readonly status: number = 401;
  readonly cause_data: Record<string, unknown> | undefined;

  constructor(message: string, code: string, cause?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.cause_data = cause;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      cause: this.cause_data,
    };
  }
}

export class TokenExpiredError extends TokenError {
  constructor(exp: number, now: number) {
    super(`Token expired at ${new Date(exp * 1000).toISOString()}`, 'TOKEN_EXPIRED', { exp, now });
  }
}

export class TokenNotBeforeError extends TokenError {
  constructor(nbf: number, now: number) {
    super(`Token not yet valid (nbf=${nbf}, now=${now})`, 'TOKEN_NOT_YET_VALID', { nbf, now });
  }
}

export class TokenSignatureError extends TokenError {
  constructor(detail?: string) {
    super(detail ?? 'Token signature verification failed', 'TOKEN_SIGNATURE_INVALID');
  }
}

export class TokenAudienceError extends TokenError {
  constructor(expected: string, actual: string | undefined) {
    super(
      `Token audience mismatch: expected '${expected}', got '${actual ?? 'undefined'}'`,
      'TOKEN_AUDIENCE_INVALID',
      { expected, actual },
    );
  }
}

export class TokenIssuerError extends TokenError {
  constructor(expected: string, actual: string | undefined) {
    super(
      `Token issuer mismatch: expected '${expected}', got '${actual ?? 'undefined'}'`,
      'TOKEN_ISSUER_INVALID',
      { expected, actual },
    );
  }
}

export class TokenInvalidError extends TokenError {
  constructor(detail: string) {
    super(`Token invalid: ${detail}`, 'TOKEN_INVALID');
  }
}

export class TokenMissingClaimError extends TokenError {
  constructor(claim: string) {
    super(`Token missing required claim: ${claim}`, 'TOKEN_MISSING_CLAIM', { claim });
  }
}

export function isTokenError(err: unknown): err is TokenError {
  return err instanceof TokenError;
}
