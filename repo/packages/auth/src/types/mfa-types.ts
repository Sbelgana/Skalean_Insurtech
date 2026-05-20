/**
 * @insurtech/auth/types/mfa-types
 */

export interface MfaSetupResult {
  setup_token: string;
  secret_b32: string;
  qr_code_data_url: string;
  otpauth_url: string;
  expires_at: number;
}

export interface MfaConfirmResult {
  mfa_enabled: true;
  recovery_codes: readonly string[];
  recovery_codes_warning: 'These codes are shown ONLY ONCE. Save them in a secure location.';
}

export interface MfaVerifyResult {
  valid: boolean;
  used_recovery_code?: boolean;
  recovery_code_index_used?: number;
}

export interface MfaChallengeRecord {
  user_id: string;
  email: string;
  created_at: number;
  expires_at: number;
}

export interface MfaSetupPendingRecord {
  user_id: string;
  secret_b32: string;
  created_at: number;
  expires_at: number;
}
