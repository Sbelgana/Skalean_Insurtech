/**
 * @insurtech/auth/errors/lockout-errors
 */

export class LockoutError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 401) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}

export class AccountLockedError extends LockoutError {
  readonly locked_until: number;
  readonly current_tier: number;
  readonly retry_after_seconds: number;

  constructor(lockedUntil: number, tier: number) {
    const now = Math.floor(Date.now() / 1000);
    const retryAfter = Math.max(lockedUntil - now, 0);
    super(`Account locked. Try again in ${retryAfter}s`, 'ACCOUNT_LOCKED', 423);
    this.locked_until = lockedUntil;
    this.current_tier = tier;
    this.retry_after_seconds = retryAfter;
  }
}

export class AccountPermanentlyLockedError extends LockoutError {
  constructor() {
    super('Account permanently locked. Contact support.', 'ACCOUNT_PERMANENT_LOCK', 423);
  }
}
