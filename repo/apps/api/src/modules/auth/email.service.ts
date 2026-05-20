/**
 * apps/api/src/modules/auth/email.service
 *
 * Sprint 5 stub. Sprint 5 Tache 2.1.13 will replace with Nodemailer + Handlebars.
 * Sprint 9 (comm) will extend to WhatsApp/SMS for other comm channels.
 *
 * Token is NEVER logged in clear in production. In dev/test the stub may print
 * the token for ergonomy (controllable via EMAIL_LOG_TOKEN_DEV env).
 */

import { Injectable, Logger } from '@nestjs/common';

export type EmailLocale = 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';

export interface SendVerificationInput {
  to: string;
  locale: EmailLocale;
  token: string;
  display_name: string;
}

export interface SendRecoveryInput {
  to: string;
  locale: EmailLocale;
  token: string;
}

export interface SendPasswordChangedInput {
  to: string;
  locale: EmailLocale;
  display_name: string;
}

export const EMAIL_SERVICE_TOKEN = Symbol('EMAIL_SERVICE');

export interface EmailService {
  sendVerification(input: SendVerificationInput): Promise<void>;
  sendRecovery(input: SendRecoveryInput): Promise<void>;
  sendPasswordChanged(input: SendPasswordChangedInput): Promise<void>;
}

/**
 * Adapter that wraps @insurtech/comm NodemailerEmailService behind the local
 * EmailService interface used by AuthService. Activates when SMTP_HOST is set ;
 * otherwise AuthModule falls back to StubEmailService.
 */
import { NodemailerEmailService } from '@insurtech/comm';

@Injectable()
export class NodemailerEmailAdapter implements EmailService {
  private readonly inner = new NodemailerEmailService();

  onModuleInit(): void {
    this.inner.onModuleInit();
  }

  async sendVerification(input: SendVerificationInput): Promise<void> {
    return this.inner.sendVerification(input);
  }

  async sendRecovery(input: SendRecoveryInput): Promise<void> {
    return this.inner.sendRecovery(input);
  }

  async sendPasswordChanged(input: SendPasswordChangedInput): Promise<void> {
    return this.inner.sendPasswordChanged(input);
  }
}

@Injectable()
export class StubEmailService implements EmailService {
  private readonly logger = new Logger(StubEmailService.name);
  private readonly logToken: boolean;
  /** Test inspection : in-memory queue of dispatched messages. */
  readonly sent: Array<{ kind: string; to: string; locale: string; token?: string }> = [];

  constructor() {
    this.logToken = process.env['EMAIL_LOG_TOKEN_DEV'] === '1';
  }

  async sendVerification(input: SendVerificationInput): Promise<void> {
    const entry: { kind: string; to: string; locale: string; token?: string } = {
      kind: 'verification',
      to: input.to,
      locale: input.locale,
      token: input.token,
    };
    if (!this.logToken) {
      // production : token is in entry for test access but the logger below won't print it
    }
    this.sent.push(entry);
    this.logger.log({
      action: 'email_send_verification_stub',
      to: input.to,
      locale: input.locale,
    });
  }

  async sendRecovery(input: SendRecoveryInput): Promise<void> {
    const entry: { kind: string; to: string; locale: string; token?: string } = {
      kind: 'recovery',
      to: input.to,
      locale: input.locale,
      token: input.token,
    };
    this.sent.push(entry);
    this.logger.log({
      action: 'email_send_recovery_stub',
      to: input.to,
      locale: input.locale,
    });
  }

  async sendPasswordChanged(input: SendPasswordChangedInput): Promise<void> {
    this.sent.push({ kind: 'password_changed', to: input.to, locale: input.locale });
    this.logger.log({
      action: 'email_send_password_changed_stub',
      to: input.to,
      locale: input.locale,
    });
  }
}
