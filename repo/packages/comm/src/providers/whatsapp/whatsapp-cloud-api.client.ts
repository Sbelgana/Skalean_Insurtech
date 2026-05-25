/**
 * @insurtech/comm/providers/whatsapp/whatsapp-cloud-api.client
 *
 * Client production Meta WhatsApp Business Platform Cloud API v21.0 (Sprint 9 Tache 3.2.2).
 * Utilise globalThis.fetch (undici-backed sur Node 18+) avec timeout + retry exponential.
 *
 * Placeholders strategy Sprint 8 heritage : si env demarre par "PLACEHOLDER_" -> disabled mode
 * (throw MetaDisabledError sur tout appel send).
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

import {
  MetaApiError,
  MetaDisabledError,
  MetaRateLimitError,
  mapMetaError,
} from './errors.js';
import { SimpleRateLimiter } from './rate-limiter.js';
import type {
  IWhatsAppCloudApiClient,
  PhoneNumberInfo,
  SendResult,
  SendTemplateRequest,
  SendTextRequest,
  UploadMediaResult,
} from './types.js';

export interface WhatsAppClientConfig {
  graphApiBaseUrl?: string;
  apiVersion?: string;
  phoneNumberId: string;
  accessToken: string;
  appSecret?: string;
  timeoutMs?: number;
  rateLimitPerSec?: number;
  retryAttempts?: number;
  phoneHashSecret?: string;
}

const DEFAULT_BASE_URL = 'https://graph.facebook.com';
const DEFAULT_API_VERSION = 'v21.0';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RATE_LIMIT_PER_SEC = 80;
const DEFAULT_RETRY_ATTEMPTS = 3;

@Injectable()
export class WhatsAppCloudApiClient implements IWhatsAppCloudApiClient {
  private readonly logger = new Logger(WhatsAppCloudApiClient.name);
  private readonly disabled: boolean;
  private readonly disabledReason: string | null;
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly timeoutMs: number;
  private readonly retryAttempts: number;
  private readonly rateLimiter: SimpleRateLimiter;
  private readonly phoneHashSecret: string;

  constructor(config: WhatsAppClientConfig) {
    this.baseUrl = config.graphApiBaseUrl ?? DEFAULT_BASE_URL;
    this.apiVersion = config.apiVersion ?? DEFAULT_API_VERSION;
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryAttempts = config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    this.phoneHashSecret = config.phoneHashSecret ?? 'sprint9-default-pepper';

    const ratePerSec = config.rateLimitPerSec ?? DEFAULT_RATE_LIMIT_PER_SEC;
    this.rateLimiter = new SimpleRateLimiter({
      minTimeMs: Math.floor(1000 / ratePerSec),
      maxQueueSize: 1000,
    });

    const placeholderDetected =
      this.accessToken.startsWith('PLACEHOLDER_') ||
      this.phoneNumberId.startsWith('PLACEHOLDER_') ||
      this.accessToken.length === 0;
    this.disabled = placeholderDetected;
    this.disabledReason = placeholderDetected
      ? 'WhatsApp credentials are placeholders (PLACEHOLDER_*)'
      : null;
    if (this.disabled) {
      this.logger.warn(`WhatsAppCloudApiClient initialized in DISABLED mode: ${this.disabledReason ?? ''}`);
    }
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  private assertEnabled(): void {
    if (this.disabled) {
      throw new MetaDisabledError(this.disabledReason ?? 'unknown');
    }
  }

  private hashPhone(phone: string): string {
    return createHash('sha256').update(`${phone}:${this.phoneHashSecret}`).digest('hex').slice(0, 16);
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}/${this.apiVersion}/${path}`;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  private computeBackoff(attempt: number): number {
    const base = [1000, 5000, 30_000];
    const baseMs = base[attempt] ?? base[base.length - 1] ?? 30_000;
    const jitter = baseMs * (Math.random() * 0.4 - 0.2);
    return Math.max(0, baseMs + jitter);
  }

  private async httpRequestWithRetry(
    url: string,
    init: RequestInit,
    operation: string,
  ): Promise<unknown> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < this.retryAttempts + 1; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, init);
        const text = await response.text();
        let body: unknown = null;
        try {
          body = text.length > 0 ? JSON.parse(text) : null;
        } catch {
          body = { rawText: text };
        }

        if (response.ok) {
          return body;
        }

        const typed = mapMetaError(response.status, body);

        if (!typed.retryable || attempt >= this.retryAttempts) {
          throw typed;
        }

        const waitMs =
          typed instanceof MetaRateLimitError ? typed.retryAfterMs : this.computeBackoff(attempt);
        this.logger.warn(
          `Meta API ${operation} attempt=${attempt + 1} retryable error=${typed.name}; backoff=${waitMs}ms`,
        );
        await this.sleep(waitMs);
        lastError = typed;
      } catch (err) {
        if (err instanceof MetaApiError && !err.retryable) {
          throw err;
        }
        if (attempt >= this.retryAttempts) {
          throw err;
        }
        const wait = this.computeBackoff(attempt);
        this.logger.warn(
          `Meta API ${operation} attempt=${attempt + 1} network error; backoff=${wait}ms`,
        );
        await this.sleep(wait);
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new MetaApiError('UNKNOWN_FAILURE');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async sendTemplate(req: SendTemplateRequest): Promise<SendResult> {
    this.assertEnabled();
    if (req.to.length === 0) throw new Error('WA_SEND_TO_EMPTY');
    if (req.templateName.length === 0) throw new Error('WA_SEND_TEMPLATE_EMPTY');

    const body = {
      messaging_product: 'whatsapp',
      to: req.to,
      type: 'template',
      template: {
        name: req.templateName,
        language: { code: req.languageCode },
        components: req.components,
      },
    };

    const url = this.buildUrl(`${this.phoneNumberId}/messages`);
    const start = Date.now();
    const responseBody = (await this.rateLimiter.schedule(() =>
      this.httpRequestWithRetry(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        'sendTemplate',
      ),
    )) as { messages?: Array<{ id: string }>; contacts?: Array<{ wa_id: string }> };

    const messageId = responseBody.messages?.[0]?.id;
    const recipientId = responseBody.contacts?.[0]?.wa_id ?? req.to;
    if (messageId === undefined) {
      throw new MetaApiError('WA_SEND_NO_MESSAGE_ID', { httpStatus: 200, originalResponse: responseBody });
    }
    this.logger.log(
      `wa_send_template_complete duration_ms=${Date.now() - start} message_id=${messageId} recipient_hash=${this.hashPhone(req.to)} template=${req.templateName}`,
    );
    return { messageId, recipientId };
  }

  async sendText(req: SendTextRequest): Promise<SendResult> {
    this.assertEnabled();
    if (req.body.length === 0) throw new Error('WA_SEND_BODY_EMPTY');
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: req.to,
      type: 'text',
      text: { body: req.body, preview_url: false },
    };
    if (req.contextMessageId !== undefined) {
      body.context = { message_id: req.contextMessageId };
    }
    const url = this.buildUrl(`${this.phoneNumberId}/messages`);
    const responseBody = (await this.rateLimiter.schedule(() =>
      this.httpRequestWithRetry(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        'sendText',
      ),
    )) as { messages?: Array<{ id: string }>; contacts?: Array<{ wa_id: string }> };

    const messageId = responseBody.messages?.[0]?.id;
    const recipientId = responseBody.contacts?.[0]?.wa_id ?? req.to;
    if (messageId === undefined) {
      throw new MetaApiError('WA_SEND_NO_MESSAGE_ID', { originalResponse: responseBody });
    }
    return { messageId, recipientId };
  }

  async markAsRead(messageId: string): Promise<void> {
    this.assertEnabled();
    const url = this.buildUrl(`${this.phoneNumberId}/messages`);
    await this.rateLimiter.schedule(() =>
      this.httpRequestWithRetry(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
        },
        'markAsRead',
      ),
    );
  }

  async getPhoneNumberInfo(): Promise<PhoneNumberInfo> {
    this.assertEnabled();
    const url = this.buildUrl(this.phoneNumberId);
    const body = (await this.httpRequestWithRetry(
      url,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
      'getPhoneNumberInfo',
    )) as Record<string, unknown>;
    return {
      verifiedName: typeof body.verified_name === 'string' ? body.verified_name : undefined,
      codeVerificationStatus:
        typeof body.code_verification_status === 'string'
          ? (body.code_verification_status as string)
          : undefined,
      displayPhoneNumber:
        typeof body.display_phone_number === 'string'
          ? (body.display_phone_number as string)
          : undefined,
      qualityRating:
        typeof body.quality_rating === 'string' ? (body.quality_rating as string) : undefined,
      phoneNumberId: this.phoneNumberId,
    };
  }

  async uploadMedia(buffer: Buffer, mimeType: string, filename?: string): Promise<UploadMediaResult> {
    this.assertEnabled();
    if (buffer.byteLength > 16 * 1024 * 1024) {
      throw new Error('WA_MEDIA_TOO_LARGE: 16MB max');
    }
    const url = this.buildUrl(`${this.phoneNumberId}/media`);
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    const blobSource = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    form.append('file', new Blob([blobSource], { type: mimeType }), filename ?? 'upload.bin');
    const responseBody = (await this.httpRequestWithRetry(
      url,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: form,
      },
      'uploadMedia',
    )) as { id?: string };
    if (typeof responseBody.id !== 'string') {
      throw new MetaApiError('WA_UPLOAD_NO_MEDIA_ID', { originalResponse: responseBody });
    }
    return { mediaId: responseBody.id };
  }
}
