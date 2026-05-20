/**
 * apps/api/src/modules/auth/audit-auth.service
 *
 * Centralised auditing of auth operations. Sprint 5 Tache 2.1.12.
 *
 * Sprint 6 will wire actual `audit_log` table inserts via @insurtech/database
 * subscriber. Sprint 9 will plug Kafka publication via @insurtech/shared-events
 * KafkaPublisher onto `insurtech.events.auth.*` topics.
 *
 * For Sprint 5 the service exposes a stable surface and emits Pino-structured
 * logs that downstream observability (loki/elk + SIEM) can ingest already.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  type AuthEventEnvelope,
  AuthEventKind,
  type AuthRole,
} from '@insurtech/auth';
import { randomUUID } from 'node:crypto';

export interface AuditContextBase {
  tenant_id: string | null;
  user_id: string | null;
  user_email: string | null;
  user_role: AuthRole | null;
  session_id: string | null;
  ip: string;
  user_agent: string;
  request_id: string;
}

export interface AuditPublisher {
  publish(envelope: AuthEventEnvelope): Promise<void>;
}

/**
 * Sprint 5 default publisher : Pino structured log.
 * Sprint 9 will replace with KafkaPublisher.
 */
@Injectable()
export class PinoAuditPublisher implements AuditPublisher {
  private readonly logger = new Logger('AuthAuditEvent');

  /** Test inspection : in-memory queue of published envelopes. */
  readonly published: AuthEventEnvelope[] = [];

  async publish(envelope: AuthEventEnvelope): Promise<void> {
    this.published.push(envelope);
    this.logger.log({
      ...envelope,
      action: 'audit_event_published',
    });
  }
}

export const AUDIT_PUBLISHER_TOKEN = Symbol('AUDIT_PUBLISHER');

@Injectable()
export class AuditAuthService {
  private readonly logger = new Logger(AuditAuthService.name);
  private readonly programVersion = '2.2.0';
  private readonly sprint = 5;

  constructor(
    private readonly publisher: AuditPublisher = new PinoAuditPublisher(),
  ) {}

  setPublisher(publisher: AuditPublisher): void {
    (this as unknown as { publisher: AuditPublisher }).publisher = publisher;
  }

  private buildEnvelope<P>(
    kind: AuthEventKind,
    ctx: AuditContextBase,
    payload: P,
  ): AuthEventEnvelope<P> {
    return {
      event_id: randomUUID(),
      event_kind: kind,
      occurred_at: new Date().toISOString(),
      tenant_id: ctx.tenant_id,
      user_id: ctx.user_id,
      user_email: ctx.user_email,
      user_role: ctx.user_role,
      session_id: ctx.session_id,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      request_id: ctx.request_id,
      payload,
      context: { program_version: this.programVersion, sprint: this.sprint },
    };
  }

  async logSignupStarted(
    ctx: AuditContextBase,
    payload: { email: string; locale: string },
  ): Promise<void> {
    await this.publisher.publish(this.buildEnvelope(AuthEventKind.SignupStarted, ctx, payload));
  }

  async logSignupCompleted(
    ctx: AuditContextBase,
    payload: { email: string; role: AuthRole },
  ): Promise<void> {
    await this.publisher.publish(this.buildEnvelope(AuthEventKind.SignupCompleted, ctx, payload));
  }

  async logEmailVerified(ctx: AuditContextBase, payload: { email: string }): Promise<void> {
    await this.publisher.publish(this.buildEnvelope(AuthEventKind.EmailVerified, ctx, payload));
  }

  async logSigninSuccess(
    ctx: AuditContextBase,
    payload: { mfa_required: boolean; remember_me: boolean },
  ): Promise<void> {
    await this.publisher.publish(this.buildEnvelope(AuthEventKind.SigninSuccess, ctx, payload));
  }

  async logSigninFailed(
    ctx: AuditContextBase,
    payload: { reason: 'invalid_credentials' | 'email_not_verified' | 'account_disabled' },
  ): Promise<void> {
    await this.publisher.publish(this.buildEnvelope(AuthEventKind.SigninFailed, ctx, payload));
  }

  async logSigninLocked(
    ctx: AuditContextBase,
    payload: { tier: 1 | 2 | 3 | 4; locked_until: string },
  ): Promise<void> {
    await this.publisher.publish(this.buildEnvelope(AuthEventKind.SigninLocked, ctx, payload));
  }

  async logMfaSetupCompleted(
    ctx: AuditContextBase,
    payload: { method: 'totp' | 'webauthn'; recovery_codes_count: number },
  ): Promise<void> {
    await this.publisher.publish(
      this.buildEnvelope(AuthEventKind.MfaSetupCompleted, ctx, payload),
    );
  }

  async logMfaVerifySuccess(
    ctx: AuditContextBase,
    payload: { method: 'totp' | 'recovery_code' },
  ): Promise<void> {
    await this.publisher.publish(this.buildEnvelope(AuthEventKind.MfaVerifySuccess, ctx, payload));
  }

  async logRefreshReplayDetected(
    ctx: AuditContextBase,
    payload: {
      token_family: string;
      expected_generation: number;
      presented_generation: number;
    },
  ): Promise<void> {
    this.logger.warn({
      action: 'refresh_replay_detected_alert',
      ...payload,
    });
    await this.publisher.publish(
      this.buildEnvelope(AuthEventKind.RefreshReplayDetected, ctx, payload),
    );
  }

  async logSignout(ctx: AuditContextBase, payload: { session_id: string }): Promise<void> {
    await this.publisher.publish(this.buildEnvelope(AuthEventKind.Signout, ctx, payload));
  }

  async logRecoveryCompleted(
    ctx: AuditContextBase,
    payload: { email: string },
  ): Promise<void> {
    await this.publisher.publish(this.buildEnvelope(AuthEventKind.RecoveryCompleted, ctx, payload));
  }
}
