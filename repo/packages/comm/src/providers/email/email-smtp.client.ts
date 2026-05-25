/**
 * @insurtech/comm/providers/email/email-smtp.client
 *
 * Sprint 9 Tache 3.2.6 -- client SMTP enrichi avec :
 *   - DKIM relaxed/relaxed RSA-SHA256
 *   - List-Unsubscribe header RFC 8058 (One-click compatible Gmail)
 *   - Provider swap Mailhog (dev) <-> Mailgun SMTP (prod)
 *   - Placeholders strategy heritage Sprint 8 : PLACEHOLDER_DKIM_KEY -> DKIM disabled mode
 */

import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter, type SendMailOptions } from 'nodemailer';

export interface EmailSendInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[] | undefined;
  bcc?: string[] | undefined;
  replyTo?: string | undefined;
  attachments?: ReadonlyArray<{ filename: string; content: Buffer; contentType?: string }> | undefined;
  optoutUrl?: string | undefined;
  optoutMailto?: string | undefined;
  headers?: Record<string, string> | undefined;
}

export interface EmailSendResult {
  messageId: string;
  provider: 'mailhog' | 'mailgun' | 'smtp' | 'log-only';
  accepted: number;
  rejected: number;
}

export interface EmailClientConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  fromAddress: string;
  fromName: string;
  provider: 'mailhog' | 'mailgun' | 'smtp' | 'log-only';
  dkimDomain?: string;
  dkimSelector?: string;
  dkimPrivateKey?: string;
}

const PLACEHOLDER_PREFIX = 'PLACEHOLDER_';

@Injectable()
export class EmailSmtpClient {
  private readonly logger = new Logger(EmailSmtpClient.name);
  private readonly config: EmailClientConfig;
  private transporter: Transporter | null = null;
  private readonly dkimEnabled: boolean;

  constructor(config: EmailClientConfig) {
    this.config = config;
    this.dkimEnabled =
      this.config.dkimPrivateKey !== undefined &&
      this.config.dkimPrivateKey.length > 0 &&
      !this.config.dkimPrivateKey.startsWith(PLACEHOLDER_PREFIX);

    if (this.config.host === undefined || this.config.host.length === 0) {
      this.logger.warn('EmailSmtpClient initialized in LOG-ONLY mode: no SMTP host');
      return;
    }

    const auth =
      this.config.user !== undefined && this.config.password !== undefined
        ? { user: this.config.user, pass: this.config.password }
        : undefined;

    const transportOptions: Record<string, unknown> = {
      host: this.config.host,
      port: this.config.port ?? 587,
      secure: this.config.secure ?? false,
    };
    if (auth !== undefined) transportOptions.auth = auth;
    if (this.dkimEnabled) {
      transportOptions.dkim = {
        domainName: this.config.dkimDomain ?? 'skalean-insurtech.ma',
        keySelector: this.config.dkimSelector ?? 'default',
        privateKey: this.config.dkimPrivateKey,
        hashAlgo: 'sha256',
      };
    }
    this.transporter = nodemailer.createTransport(transportOptions);
  }

  isLogOnly(): boolean {
    return this.transporter === null;
  }

  hasDkim(): boolean {
    return this.dkimEnabled;
  }

  private buildHeaders(input: EmailSendInput): Record<string, string> {
    const headers: Record<string, string> = { ...(input.headers ?? {}) };
    if (input.optoutUrl !== undefined && input.optoutUrl.length > 0) {
      const parts = [`<${input.optoutUrl}>`];
      if (input.optoutMailto !== undefined && input.optoutMailto.length > 0) {
        parts.push(`<mailto:${input.optoutMailto}>`);
      }
      headers['List-Unsubscribe'] = parts.join(', ');
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    return headers;
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const headers = this.buildHeaders(input);
    const mailOptions: SendMailOptions = {
      from: `${this.config.fromName} <${this.config.fromAddress}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? this.htmlToText(input.html),
      headers,
    };
    if (input.cc !== undefined && input.cc.length > 0) mailOptions.cc = input.cc;
    if (input.bcc !== undefined && input.bcc.length > 0) mailOptions.bcc = input.bcc;
    if (input.replyTo !== undefined) mailOptions.replyTo = input.replyTo;
    if (input.attachments !== undefined && input.attachments.length > 0) {
      mailOptions.attachments = input.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        ...(a.contentType !== undefined ? { contentType: a.contentType } : {}),
      }));
    }

    if (this.transporter === null) {
      this.logger.log(
        `email_log_only to=${this.maskEmail(input.to)} subject="${input.subject}" headers=${JSON.stringify(headers)}`,
      );
      return {
        messageId: `log-only-${Date.now()}`,
        provider: 'log-only',
        accepted: 1,
        rejected: 0,
      };
    }

    const info = await this.transporter.sendMail(mailOptions);
    return {
      messageId: info.messageId ?? `unknown-${Date.now()}`,
      provider: this.config.provider,
      accepted: info.accepted?.length ?? 0,
      rejected: info.rejected?.length ?? 0,
    };
  }

  /**
   * Light HTML -> text fallback (Sprint 9 Tache 3.2.7 uses node-html-to-text for richer rendering).
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/?[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private maskEmail(email: string): string {
    const idx = email.indexOf('@');
    if (idx < 0) return '***';
    const local = email.slice(0, idx);
    const domain = email.slice(idx);
    return `${local.slice(0, 2)}***${domain}`;
  }
}
