/**
 * @insurtech/auth/schemas
 *
 * Barrel selectif des schemas Zod publics. Aucun export *.
 */

export { signupSchema, parseSignup, safeParseSignup } from './signup.schema.js';
export type { SignupInput } from './signup.schema.js';

export { signinSchema, parseSignin } from './signin.schema.js';
export type { SigninInput } from './signin.schema.js';

export {
  mfaSetupRequestSchema,
  mfaSetupConfirmSchema,
  mfaVerifySchema,
  mfaDisableSchema,
  mfaRecoveryCodeRegenerateSchema,
} from './mfa.schema.js';
export type {
  MfaSetupRequestInput,
  MfaSetupConfirmInput,
  MfaVerifyInput,
  MfaDisableInput,
  MfaRecoveryCodeRegenerateInput,
} from './mfa.schema.js';

export { refreshSchema, parseRefresh } from './refresh.schema.js';
export type { RefreshInput } from './refresh.schema.js';

export { recoveryRequestSchema, recoveryConfirmSchema } from './recovery.schema.js';
export type { RecoveryRequestInput, RecoveryConfirmInput } from './recovery.schema.js';

export { changePasswordSchema } from './change-password.schema.js';
export type { ChangePasswordInput } from './change-password.schema.js';

export { verifyEmailSchema, resendVerificationSchema } from './verify-email.schema.js';
export type { VerifyEmailInput, ResendVerificationInput } from './verify-email.schema.js';
