/**
 * apps/api/src/modules/auth/auth.errors
 *
 * Strongly typed API auth errors mapped to HTTP responses.
 */

import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiAuthError extends HttpException {
  readonly code: string;

  constructor(code: string, message: string, status: HttpStatus = HttpStatus.UNAUTHORIZED) {
    super({ code, message, error: 'Unauthorized' }, status);
    this.code = code;
  }
}

export const InvalidCredentialsError = (): ApiAuthError =>
  new ApiAuthError('INVALID_CREDENTIALS', 'Invalid email or password');

export const AccountLockedError = (lockedUntil: Date | null): ApiAuthError =>
  new ApiAuthError(
    'ACCOUNT_LOCKED',
    lockedUntil
      ? `Account locked until ${lockedUntil.toISOString()}`
      : 'Account temporarily locked',
    423 as HttpStatus,
  );

export const AccountDisabledError = (): ApiAuthError =>
  new ApiAuthError('ACCOUNT_DISABLED', 'Account disabled');

export const AccountDeletedError = (): ApiAuthError =>
  new ApiAuthError('ACCOUNT_DELETED', 'Account deleted');

export const EmailNotVerifiedError = (): ApiAuthError =>
  new ApiAuthError('EMAIL_NOT_VERIFIED', 'Email not verified -- please confirm your email first');

export const TokenReuseDetectedError = (): ApiAuthError =>
  new ApiAuthError('TOKEN_REUSE_DETECTED', 'Refresh token replay detected -- all sessions revoked');

export const MfaRequiredError = (): ApiAuthError =>
  new ApiAuthError('MFA_REQUIRED', 'MFA verification required', HttpStatus.UNAUTHORIZED);

export const InvalidRefreshTokenError = (detail?: string): ApiAuthError =>
  new ApiAuthError('INVALID_REFRESH_TOKEN', detail ?? 'Refresh token invalid or expired');

export const MfaNotEnabledError = (): ApiAuthError =>
  new ApiAuthError('MFA_NOT_ENABLED', 'MFA is not enabled for this account', HttpStatus.BAD_REQUEST);

export const MfaAlreadyEnabledError = (): ApiAuthError =>
  new ApiAuthError('MFA_ALREADY_ENABLED', 'MFA is already enabled', HttpStatus.CONFLICT);

export const MfaInvalidCodeError = (): ApiAuthError =>
  new ApiAuthError('MFA_INVALID_CODE', 'Invalid MFA code or recovery code');

export const MfaChallengeExpiredError = (): ApiAuthError =>
  new ApiAuthError(
    'MFA_CHALLENGE_EXPIRED',
    'MFA challenge token expired -- restart signin',
  );

export const MfaSetupExpiredError = (): ApiAuthError =>
  new ApiAuthError('MFA_SETUP_EXPIRED', 'MFA setup token expired -- restart setup');
