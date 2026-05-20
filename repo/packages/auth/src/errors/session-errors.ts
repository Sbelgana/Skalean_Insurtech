/**
 * @insurtech/auth/errors/session-errors
 *
 * Errors thrown by SessionService.
 */

export class SessionError extends Error {
  readonly code: string;
  readonly status: number = 401;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class SessionNotFoundError extends SessionError {
  constructor(jti: string) {
    super(`Session not found: ${jti}`, 'SESSION_NOT_FOUND');
  }
}

export class SessionExpiredError extends SessionError {
  constructor(jti: string) {
    super(`Session expired: ${jti}`, 'SESSION_EXPIRED');
  }
}

export class SessionRevokedError extends SessionError {
  constructor(jti: string) {
    super(`Session revoked: ${jti}`, 'SESSION_REVOKED');
  }
}

export class RefreshReplayDetectedError extends SessionError {
  readonly token_family: string;
  readonly expected_generation: number;
  readonly presented_generation: number;

  constructor(family: string, presented: number, expected: number) {
    super(
      `Refresh token replay detected (family=${family}, presented=${presented}, expected=${expected})`,
      'REFRESH_REPLAY_DETECTED',
    );
    this.token_family = family;
    this.expected_generation = expected;
    this.presented_generation = presented;
  }
}

export function isSessionError(err: unknown): err is SessionError {
  return err instanceof SessionError;
}
