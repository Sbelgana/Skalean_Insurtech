/**
 * @insurtech/comm/providers/whatsapp/mock-whatsapp.client
 *
 * Mock interface-equivalent au client real (Sprint 9 Tache 3.2.2).
 * Permet tests E2E + dev sans frais Meta + sans dependance reseau.
 */

import { Injectable, Logger } from '@nestjs/common';

import {
  MetaApiError,
  MetaInvalidTemplateError,
  MetaPhoneNotOptedInError,
  MetaRateLimitError,
  MetaTemplateNotApprovedError,
} from './errors.js';
import type {
  IWhatsAppCloudApiClient,
  PhoneNumberInfo,
  SendResult,
  SendTemplateRequest,
  SendTextRequest,
  UploadMediaResult,
} from './types.js';

export interface MockSentRecord {
  to: string;
  templateName?: string | undefined;
  text?: string | undefined;
  languageCode?: string | undefined;
  messageId: string;
  at: Date;
}

export interface MockFlags {
  simulateRateLimit?: boolean;
  simulateInvalidTemplate?: boolean;
  simulateTemplateNotApproved?: boolean;
  simulatePhoneNotOptedIn?: boolean;
  simulateNetworkError?: boolean;
}

@Injectable()
export class MockWhatsAppCloudApiClient implements IWhatsAppCloudApiClient {
  private readonly logger = new Logger(MockWhatsAppCloudApiClient.name);
  public sent: MockSentRecord[] = [];
  public marksRead: string[] = [];
  public uploads: Array<{ size: number; mimeType: string; filename?: string | undefined; mediaId: string }> = [];
  public flags: MockFlags = {};
  private counter = 0;

  reset(): void {
    this.sent = [];
    this.marksRead = [];
    this.uploads = [];
    this.flags = {};
    this.counter = 0;
  }

  setFlags(flags: MockFlags): void {
    this.flags = { ...flags };
  }

  isDisabled(): boolean {
    return false;
  }

  private nextId(): string {
    this.counter += 1;
    return `wamid.MOCK_${this.counter.toString(16).padStart(8, '0')}`;
  }

  private maybeThrow(operation: string): void {
    if (this.flags.simulateNetworkError === true) {
      throw new MetaApiError(`Simulated network error (${operation})`, { retryable: true });
    }
    if (this.flags.simulateRateLimit === true) {
      throw new MetaRateLimitError('Simulated rate limit', 1000, { code: 130429 });
    }
    if (this.flags.simulateInvalidTemplate === true) {
      throw new MetaInvalidTemplateError('Simulated invalid template', { code: 130 });
    }
    if (this.flags.simulateTemplateNotApproved === true) {
      throw new MetaTemplateNotApprovedError('Simulated template not approved', { code: 132 });
    }
    if (this.flags.simulatePhoneNotOptedIn === true) {
      throw new MetaPhoneNotOptedInError('Simulated phone not opted in', { code: 131 });
    }
  }

  async sendTemplate(req: SendTemplateRequest): Promise<SendResult> {
    this.maybeThrow('sendTemplate');
    const messageId = this.nextId();
    this.sent.push({
      to: req.to,
      templateName: req.templateName,
      languageCode: req.languageCode,
      messageId,
      at: new Date(),
    });
    this.logger.log(`mock wa_send_template to=${req.to} template=${req.templateName} id=${messageId}`);
    return await Promise.resolve({ messageId, recipientId: req.to });
  }

  async sendText(req: SendTextRequest): Promise<SendResult> {
    this.maybeThrow('sendText');
    const messageId = this.nextId();
    this.sent.push({ to: req.to, text: req.body, messageId, at: new Date() });
    return await Promise.resolve({ messageId, recipientId: req.to });
  }

  async markAsRead(messageId: string): Promise<void> {
    this.marksRead.push(messageId);
    return await Promise.resolve();
  }

  async getPhoneNumberInfo(): Promise<PhoneNumberInfo> {
    return await Promise.resolve({
      verifiedName: 'Skalean Insurtech (Mock)',
      codeVerificationStatus: 'VERIFIED',
      displayPhoneNumber: '+212 5XX-XXXXXX',
      qualityRating: 'GREEN',
      phoneNumberId: 'mock-phone-id',
    });
  }

  async uploadMedia(buffer: Buffer, mimeType: string, filename?: string): Promise<UploadMediaResult> {
    this.maybeThrow('uploadMedia');
    const mediaId = `mock-media-${++this.counter}`;
    this.uploads.push({ size: buffer.byteLength, mimeType, filename, mediaId });
    return await Promise.resolve({ mediaId });
  }
}
