/**
 * @insurtech/auth
 *
 * Public API of the auth package. Root barrel re-exporting curated sub-barrels.
 */

export * from './types/index.js';
export * from './schemas/index.js';
export * from './constants/index.js';

export { MfaService } from './services/mfa.service.js';
export type {
  MfaSetupResult,
  MfaConfirmResult,
  MfaVerifyResult,
  MfaChallengeRecord,
  MfaSetupPendingRecord,
} from './types/mfa-types.js';
export {
  MfaError,
  MfaInvalidCodeError,
  MfaSecretNotSetError,
  MfaSetupAlreadyExistsError,
  MfaChallengeExpiredError,
  MfaRecoveryCodeAlreadyUsedError,
  MfaSetupTokenExpiredError,
  isMfaError,
} from './errors/mfa-errors.js';

export { Argon2Service } from './services/argon2.service.js';
export type { PolicyValidationContext } from './services/argon2.service.js';
export { PepperService } from './services/pepper.service.js';
export { EncryptionService } from './services/encryption.service.js';
export { HashingService } from './services/hashing.service.js';
export { JwtService } from './services/jwt.service.js';
export { LockoutService } from './services/lockout.service.js';
export type { RedisHashLike } from './services/lockout.service.js';
export {
  LockoutError,
  AccountLockedError as LockoutAccountLockedError,
  AccountPermanentlyLockedError,
} from './errors/lockout-errors.js';

export { SessionService, REDIS_TOKEN } from './services/session.service.js';
export type { RedisLike, RedisMulti } from './services/session.service.js';
export {
  NoOpSessionRepository,
  SESSION_REPOSITORY_TOKEN,
} from './services/session.repository.js';
export type { SessionRepository } from './services/session.repository.js';

export {
  TokenError,
  TokenExpiredError,
  TokenNotBeforeError,
  TokenSignatureError,
  TokenAudienceError,
  TokenIssuerError,
  TokenInvalidError,
  TokenMissingClaimError,
  isTokenError,
} from './errors/token-errors.js';

export {
  SessionError,
  SessionNotFoundError,
  SessionExpiredError,
  SessionRevokedError,
  RefreshReplayDetectedError,
  isSessionError,
} from './errors/session-errors.js';

export type {
  PasswordPolicyReason,
  PasswordPolicyResult,
} from './types/password-policy-result.js';
export { ALL_PASSWORD_POLICY_REASONS } from './types/password-policy-result.js';

export type { EncryptedPayload, EncryptedString } from './types/encrypted-payload.js';
export type { SignedJwt, TokenPair } from './types/token-pair.js';
export type {
  SessionMetadata,
  CreateSessionInput,
  RotateSessionInput,
} from './types/session-metadata.js';

export { AuthModule } from './auth.module.js';

// Sprint 6 Tache 2.2.1 -- Tenant context multi-tenant runtime
export {
  TENANT_CONTEXT_ERROR_CODES,
  TenantContextService,
  tenantContextStorage,
} from './services/tenant-context.service.js';
export { TenantContextModule } from './modules/tenant-context.module.js';
export {
  buildMockTenantContext,
  buildMockTenantSettings,
  withAssureContext,
  withSuperAdminContext,
  withTenantContext,
} from './testing/tenant-context-test.helper.js';

export const AUTH_PACKAGE_VERSION = '0.1.0';
