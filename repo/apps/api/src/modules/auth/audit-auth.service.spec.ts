/**
 * Tests for AuditAuthService (apps/api).
 * Sprint 5 Tache 2.1.12.
 */

import { describe, expect, it } from 'vitest';
import { AuthEventKind, AuthRole } from '@insurtech/auth';
import {
  AuditAuthService,
  type AuditContextBase,
  PinoAuditPublisher,
} from './audit-auth.service';

const baseCtx: AuditContextBase = {
  tenant_id: 't1',
  user_id: 'u1',
  user_email: 'a@b.co',
  user_role: AuthRole.BrokerUser,
  session_id: 'sid1',
  ip: '1.2.3.4',
  user_agent: 'vitest',
  request_id: 'req-1',
};

describe('AuditAuthService', () => {
  it('publishes signup_started with full envelope', async () => {
    const publisher = new PinoAuditPublisher();
    const svc = new AuditAuthService(publisher);
    await svc.logSignupStarted(baseCtx, { email: 'a@b.co', locale: 'fr-MA' });
    expect(publisher.published).toHaveLength(1);
    const env = publisher.published[0];
    expect(env?.event_kind).toBe(AuthEventKind.SignupStarted);
    expect(env?.tenant_id).toBe('t1');
    expect(env?.user_id).toBe('u1');
    expect(env?.context.program_version).toBe('2.2.0');
    expect(env?.context.sprint).toBe(5);
    expect(env?.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('publishes signin_success with mfa_required + remember_me payload', async () => {
    const publisher = new PinoAuditPublisher();
    const svc = new AuditAuthService(publisher);
    await svc.logSigninSuccess(baseCtx, { mfa_required: false, remember_me: true });
    const env = publisher.published[0];
    expect(env?.event_kind).toBe(AuthEventKind.SigninSuccess);
    expect((env?.payload as { mfa_required: boolean }).mfa_required).toBe(false);
    expect((env?.payload as { remember_me: boolean }).remember_me).toBe(true);
  });

  it('publishes signin_failed with reason', async () => {
    const publisher = new PinoAuditPublisher();
    const svc = new AuditAuthService(publisher);
    await svc.logSigninFailed(baseCtx, { reason: 'invalid_credentials' });
    const env = publisher.published[0];
    expect(env?.event_kind).toBe(AuthEventKind.SigninFailed);
    expect((env?.payload as { reason: string }).reason).toBe('invalid_credentials');
  });

  it('publishes signin_locked with tier and locked_until', async () => {
    const publisher = new PinoAuditPublisher();
    const svc = new AuditAuthService(publisher);
    await svc.logSigninLocked(baseCtx, { tier: 2, locked_until: '2026-05-21T00:00:00Z' });
    expect((publisher.published[0]?.payload as { tier: number }).tier).toBe(2);
  });

  it('publishes mfa_setup_completed + mfa_verify_success', async () => {
    const publisher = new PinoAuditPublisher();
    const svc = new AuditAuthService(publisher);
    await svc.logMfaSetupCompleted(baseCtx, { method: 'totp', recovery_codes_count: 6 });
    await svc.logMfaVerifySuccess(baseCtx, { method: 'totp' });
    expect(publisher.published).toHaveLength(2);
    expect(publisher.published[0]?.event_kind).toBe(AuthEventKind.MfaSetupCompleted);
    expect(publisher.published[1]?.event_kind).toBe(AuthEventKind.MfaVerifySuccess);
  });

  it('publishes refresh_replay_detected with family + generations', async () => {
    const publisher = new PinoAuditPublisher();
    const svc = new AuditAuthService(publisher);
    await svc.logRefreshReplayDetected(baseCtx, {
      token_family: 'fam-1',
      expected_generation: 5,
      presented_generation: 2,
    });
    const env = publisher.published[0];
    expect(env?.event_kind).toBe(AuthEventKind.RefreshReplayDetected);
    expect((env?.payload as { token_family: string }).token_family).toBe('fam-1');
  });

  it('publishes signout + recovery_completed', async () => {
    const publisher = new PinoAuditPublisher();
    const svc = new AuditAuthService(publisher);
    await svc.logSignout(baseCtx, { session_id: 'sid1' });
    await svc.logRecoveryCompleted(baseCtx, { email: 'a@b.co' });
    expect(publisher.published).toHaveLength(2);
    expect(publisher.published[0]?.event_kind).toBe(AuthEventKind.Signout);
    expect(publisher.published[1]?.event_kind).toBe(AuthEventKind.RecoveryCompleted);
  });
});
