/**
 * apps/api/src/modules/auth/dto/mfa-response.dto
 */

import type { UserPublic } from './auth-response.dto.js';

export interface SetupMfaResponse {
  setup_token: string;
  secret_b32: string;
  qr_code_data_url: string;
  otpauth_url: string;
  expires_at: number;
}

export interface ConfirmMfaResponse {
  mfa_enabled: true;
  recovery_codes: readonly string[];
  recovery_codes_warning: string;
  message: 'MFA enabled. All sessions revoked. Please sign in again with MFA.';
}

export interface VerifyMfaResponse {
  access_token: string;
  refresh_token: string;
  access_expires_at: number;
  refresh_expires_at: number;
  token_type: 'Bearer';
  user: UserPublic;
  mfa_verified: true;
}

export interface DisableMfaResponse {
  mfa_enabled: false;
  message: 'MFA disabled. All sessions revoked.';
  sessions_revoked: number;
}
