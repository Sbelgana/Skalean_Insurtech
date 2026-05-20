/**
 * @insurtech/comm/nodemailer-email.service
 *
 * Nodemailer-backed EmailService implementation.
 * Sprint 5 Tache 2.1.13.
 *
 * SMTP via Mailhog in dev / Mailgun/Sendgrid in prod (Sprint 12). When
 * SMTP_HOST is missing, this service falls back to logging the dispatch
 * (test-friendly mode).
 *
 * Templates : Handlebars-compiled in templates.ts, 3 templates x 4 locales.
 */

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  type EmailLocale,
  renderPasswordChanged,
  renderRecovery,
  renderVerify,
} from './templates.js';

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

@Injectable()
export class NodemailerEmailService implements OnModuleInit {
  private readonly logger = new Logger(NodemailerEmailService.name);
  private transporter: Transporter | null = null;
  private fromAddress = 'noreply@skalean.ma';
  private fromName = 'Skalean InsurTech';
  private publicBaseUrl = 'https://app.skalean.ma';

  onModuleInit(): void {
    const host = process.env['SMTP_HOST'];
    if (!host) {
      this.logger.warn({
        action: 'nodemailer_no_smtp_host',
        note: 'SMTP_HOST not set -- falling back to log-only mode',
      });
      return;
    }
    this.fromAddress = process.env['SMTP_FROM_ADDRESS'] ?? this.fromAddress;
    this.fromName = process.env['SMTP_FROM_NAME'] ?? this.fromName;
    this.publicBaseUrl = process.env['PUBLIC_BASE_URL'] ?? this.publicBaseUrl;
    const port = Number.parseInt(process.env['SMTP_PORT'] ?? '587', 10);
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_PASSWORD'];
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
    this.logger.log({
      action: 'nodemailer_init',
      host,
      port,
      from: this.fromAddress,
    });
  }

  async sendVerification(input: SendVerificationInput): Promise<void> {
    const verifyUrl = `${this.publicBaseUrl}/auth/verify-email?token=${encodeURIComponent(
      input.token,
    )}`;
    const { subject, body } = renderVerify(input.locale, {
      display_name: input.display_name,
      verify_url: verifyUrl,
    });
    await this.dispatch(input.to, subject, body, 'verification');
  }

  async sendRecovery(input: SendRecoveryInput): Promise<void> {
    const resetUrl = `${this.publicBaseUrl}/auth/reset-password?token=${encodeURIComponent(
      input.token,
    )}`;
    const { subject, body } = renderRecovery(input.locale, { reset_url: resetUrl });
    await this.dispatch(input.to, subject, body, 'recovery');
  }

  async sendPasswordChanged(input: SendPasswordChangedInput): Promise<void> {
    const { subject, body } = renderPasswordChanged(input.locale, {
      display_name: input.display_name,
    });
    await this.dispatch(input.to, subject, body, 'password_changed');
  }

  private async dispatch(
    to: string,
    subject: string,
    body: string,
    kind: string,
  ): Promise<void> {
    if (this.transporter === null) {
      this.logger.log({ action: 'email_dispatch_log_only', to, kind, subject });
      return;
    }
    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to,
        subject,
        text: body,
      });
      this.logger.log({ action: 'email_sent', to, kind, subject });
    } catch (err: unknown) {
      this.logger.error(
        {
          action: 'email_send_failed',
          err: err instanceof Error ? err.message : String(err),
          to,
          kind,
        },
        'Nodemailer sendMail failed -- treating as non-blocking',
      );
    }
  }
}
