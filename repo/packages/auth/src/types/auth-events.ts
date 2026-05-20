/**
 * @insurtech/auth/types/auth-events
 *
 * Defines AuthEventKind enum and AuthEventEnvelope interface published on Kafka topics
 * insurtech.events.auth.{event_kind} by Sprint 5 Tache 2.1.12 AuditAuthService.
 * Consumed by Sprint 18 (notification triggers), Sprint 22 (analytics), Sprint 33 (SIEM).
 */

import type { AuthRole } from './auth-roles.js';

export enum AuthEventKind {
  SignupStarted = 'signup_started',
  SignupCompleted = 'signup_completed',
  EmailVerified = 'email_verified',
  SigninSuccess = 'signin_success',
  SigninFailed = 'signin_failed',
  SigninLocked = 'signin_locked',
  MfaSetupStarted = 'mfa_setup_started',
  MfaSetupCompleted = 'mfa_setup_completed',
  MfaVerifySuccess = 'mfa_verify_success',
  MfaVerifyFailed = 'mfa_verify_failed',
  MfaDisabled = 'mfa_disabled',
  RefreshUsed = 'refresh_used',
  RefreshReplayDetected = 'refresh_replay_detected',
  Signout = 'signout',
  SignoutAll = 'signout_all',
  RecoveryStarted = 'recovery_started',
  RecoveryCompleted = 'recovery_completed',
  PasswordChanged = 'password_changed',
  LockoutTriggered = 'lockout_triggered',
  LockoutCleared = 'lockout_cleared',
  SessionExpired = 'session_expired',
  SuspiciousLogin = 'suspicious_login',
}

/**
 * Envelope of an auth event published on Kafka.
 * Schema is verified by Zod at publish time (Sprint 5 Tache 2.1.12).
 */
export interface AuthEventEnvelope<P = Record<string, unknown>> {
  event_id: string;
  event_kind: AuthEventKind;
  occurred_at: string;
  ingested_at?: string;
  tenant_id: string | null;
  user_id: string | null;
  user_email: string | null;
  user_role: AuthRole | null;
  session_id: string | null;
  ip: string;
  user_agent: string;
  request_id: string;
  payload: P;
  context: {
    program_version: string;
    sprint: number;
  };
}

/** Type-safe payloads per event kind (mapped types). */
export interface AuthEventPayloadMap {
  [AuthEventKind.SignupStarted]: { email: string; locale: string };
  [AuthEventKind.SignupCompleted]: { email: string; role: AuthRole };
  [AuthEventKind.EmailVerified]: { email: string };
  [AuthEventKind.SigninSuccess]: { mfa_required: boolean; remember_me: boolean };
  [AuthEventKind.SigninFailed]: { reason: 'invalid_credentials' | 'email_not_verified' | 'account_disabled' };
  [AuthEventKind.SigninLocked]: { tier: 1 | 2 | 3 | 4; locked_until: string };
  [AuthEventKind.MfaSetupStarted]: { method: 'totp' | 'webauthn' };
  [AuthEventKind.MfaSetupCompleted]: { method: 'totp' | 'webauthn'; recovery_codes_count: number };
  [AuthEventKind.MfaVerifySuccess]: { method: 'totp' | 'recovery_code' };
  [AuthEventKind.MfaVerifyFailed]: { method: 'totp' | 'recovery_code'; reason: string };
  [AuthEventKind.MfaDisabled]: { method: 'totp' | 'webauthn' };
  [AuthEventKind.RefreshUsed]: { token_family: string; generation: number };
  [AuthEventKind.RefreshReplayDetected]: {
    token_family: string;
    expected_generation: number;
    presented_generation: number;
  };
  [AuthEventKind.Signout]: { session_id: string };
  [AuthEventKind.SignoutAll]: { sessions_revoked: number };
  [AuthEventKind.RecoveryStarted]: { email: string };
  [AuthEventKind.RecoveryCompleted]: { email: string };
  [AuthEventKind.PasswordChanged]: Record<string, never>;
  [AuthEventKind.LockoutTriggered]: { tier: 1 | 2 | 3 | 4; failed_attempts: number };
  [AuthEventKind.LockoutCleared]: { reason: 'manual' | 'expired' | 'recovery_completed' };
  [AuthEventKind.SessionExpired]: { session_id: string; reason: 'idle' | 'absolute' };
  [AuthEventKind.SuspiciousLogin]: { signal: string; risk_score: number };
}

/** Constructor returning a typed envelope for kind K. */
export type TypedAuthEvent<K extends AuthEventKind> = AuthEventEnvelope<AuthEventPayloadMap[K]> & {
  event_kind: K;
};
