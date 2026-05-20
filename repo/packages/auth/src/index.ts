/**
 * @insurtech/auth
 *
 * Public API of the auth package. Root barrel re-exporting curated sub-barrels.
 */

export * from './types/index.js';
export * from './schemas/index.js';
export * from './constants/index.js';

export { Argon2Service } from './services/argon2.service.js';
export type { PolicyValidationContext } from './services/argon2.service.js';
export { PepperService } from './services/pepper.service.js';
export { EncryptionService } from './services/encryption.service.js';
export { HashingService } from './services/hashing.service.js';
export { JwtService } from './services/jwt.service.js';

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

export type {
  PasswordPolicyReason,
  PasswordPolicyResult,
} from './types/password-policy-result.js';
export { ALL_PASSWORD_POLICY_REASONS } from './types/password-policy-result.js';

export type { EncryptedPayload, EncryptedString } from './types/encrypted-payload.js';
export type { SignedJwt, TokenPair } from './types/token-pair.js';

export { AuthModule } from './auth.module.js';

export const AUTH_PACKAGE_VERSION = '0.1.0';
