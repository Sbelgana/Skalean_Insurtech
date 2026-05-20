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
export type {
  PasswordPolicyReason,
  PasswordPolicyResult,
} from './types/password-policy-result.js';
export { ALL_PASSWORD_POLICY_REASONS } from './types/password-policy-result.js';

export { AuthModule } from './auth.module.js';

export const AUTH_PACKAGE_VERSION = '0.1.0';
