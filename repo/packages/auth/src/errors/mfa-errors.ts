/**
 * @insurtech/auth/errors/mfa-errors
 */

export class MfaError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 401) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message };
  }
}

export class MfaInvalidCodeError extends MfaError {
  constructor() {
    super('Invalid MFA code', 'MFA_INVALID_CODE', 401);
  }
}

export class MfaSecretNotSetError extends MfaError {
  constructor(userId: string) {
    super(`MFA not enabled for user ${userId}`, 'MFA_NOT_ENABLED', 400);
  }
}

export class MfaSetupAlreadyExistsError extends MfaError {
  constructor() {
    super('MFA already enabled', 'MFA_ALREADY_ENABLED', 409);
  }
}

export class MfaChallengeExpiredError extends MfaError {
  constructor() {
    super('MFA challenge token expired or invalid', 'MFA_CHALLENGE_EXPIRED', 401);
  }
}

export class MfaRecoveryCodeAlreadyUsedError extends MfaError {
  constructor() {
    super('Recovery code already used', 'MFA_RECOVERY_CODE_USED', 401);
  }
}

export class MfaSetupTokenExpiredError extends MfaError {
  constructor() {
    super('MFA setup token expired -- restart setup', 'MFA_SETUP_EXPIRED', 401);
  }
}

export function isMfaError(err: unknown): err is MfaError {
  return err instanceof MfaError;
}
