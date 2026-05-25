/**
 * @insurtech/comm/providers/whatsapp/webhook-processor
 *
 * Sprint 9 Tache 3.2.4 -- traitement metier webhook Meta WhatsApp.
 * Update comm_messages.status selon events sent/delivered/read/failed
 * Insere comm_webhooks_received pour audit + idempotency dedup.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Repository } from 'typeorm';

import { MessagesRepositoryService } from '../../services/messages-repository.service.js';
import type { MessageStatus } from '../../types/channel.enum.js';
import type { MetaWebhookPayload } from '../../schemas/webhook.schema.js';
import { WhatsAppWebhookVerifier, isStopKeyword } from './webhook-verifier.js';

export const COMM_WEBHOOKS_REPO = Symbol('COMM_WEBHOOKS_REPO');

interface CommWebhookRow {
  id?: string;
  tenantId: string | null;
  provider: 'meta' | 'twilio' | 'sendgrid' | 'mailgun';
  eventType: string;
  payload: Record<string, unknown>;
  signatureValid: boolean;
  processedAt: Date | null;
  processedStatus: 'pending' | 'success' | 'duplicate' | 'invalid_signature' | 'error';
  idempotencyKey?: string;
}

export interface ProcessResult {
  status: 'processed' | 'duplicate' | 'invalid_signature' | 'error';
  events: ReadonlyArray<{ messageId: string | null; metaMessageId: string; status: MessageStatus }>;
  inboundMessages: ReadonlyArray<{ from: string; body: string; metaMessageId: string }>;
  stopKeywordsDetected: ReadonlyArray<string>;
}

const META_STATUS_MAP: Record<string, MessageStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
};

@Injectable()
export class WhatsAppWebhookProcessor {
  private readonly logger = new Logger(WhatsAppWebhookProcessor.name);

  constructor(
    private readonly messages: MessagesRepositoryService,
    private readonly verifier: WhatsAppWebhookVerifier,
    @Optional()
    @Inject(COMM_WEBHOOKS_REPO)
    private readonly webhookRepo: Repository<CommWebhookRow> | undefined,
  ) {}

  /**
   * Verifie la signature, deduplique via idempotencyKey, et traite les events.
   */
  async receive(
    rawBody: string,
    signatureHeader: string | undefined,
    parsedPayload: MetaWebhookPayload,
    tenantId: string | null = null,
  ): Promise<ProcessResult> {
    const signatureValid = this.verifier.verifySignature(rawBody, signatureHeader);
    if (!signatureValid) {
      this.logger.warn('wa_webhook_invalid_signature');
      await this.persistWebhook({
        tenantId,
        provider: 'meta',
        eventType: 'unknown',
        payload: parsedPayload as unknown as Record<string, unknown>,
        signatureValid: false,
        processedAt: new Date(),
        processedStatus: 'invalid_signature',
      });
      return {
        status: 'invalid_signature',
        events: [],
        inboundMessages: [],
        stopKeywordsDetected: [],
      };
    }

    const idempotencyKey = this.verifier.computeIdempotencyKey(rawBody);
    if (this.webhookRepo !== undefined) {
      const existing = await this.webhookRepo.findOne({
        where: { idempotencyKey } as never,
      });
      if (existing !== null) {
        return {
          status: 'duplicate',
          events: [],
          inboundMessages: [],
          stopKeywordsDetected: [],
        };
      }
    }

    const events: Array<{ messageId: string | null; metaMessageId: string; status: MessageStatus }> = [];
    const inboundMessages: Array<{ from: string; body: string; metaMessageId: string }> = [];
    const stopKeywordsDetected: string[] = [];

    for (const entry of parsedPayload.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        if (value.statuses !== undefined) {
          for (const status of value.statuses) {
            const mapped = META_STATUS_MAP[status.status];
            if (mapped === undefined) continue;
            try {
              const message = await this.messages.findByProviderMessageId('meta', status.id, tenantId ?? undefined);
              if (message !== null) {
                const updateOpts: Record<string, unknown> = {};
                if (mapped === 'sent') updateOpts.sentAt = new Date(Number(status.timestamp) * 1000);
                if (mapped === 'delivered')
                  updateOpts.deliveredAt = new Date(Number(status.timestamp) * 1000);
                if (mapped === 'read')
                  updateOpts.readAt = new Date(Number(status.timestamp) * 1000);
                if (mapped === 'failed') {
                  updateOpts.failedAt = new Date(Number(status.timestamp) * 1000);
                  updateOpts.failReason =
                    status.errors !== undefined && status.errors.length > 0
                      ? `${status.errors[0]?.code}:${status.errors[0]?.message ?? status.errors[0]?.title}`
                      : 'unknown';
                }
                await this.messages.updateStatus(message.tenantId, message.id, mapped, updateOpts);
                events.push({ messageId: message.id, metaMessageId: status.id, status: mapped });
              } else {
                events.push({ messageId: null, metaMessageId: status.id, status: mapped });
              }
            } catch (err) {
              this.logger.error(
                `wa_webhook_status_update_failed metaId=${status.id} err=${(err as Error).message}`,
              );
            }
          }
        }
        if (value.messages !== undefined) {
          for (const msg of value.messages) {
            const bodyText = msg.text?.body ?? '';
            inboundMessages.push({ from: msg.from, body: bodyText, metaMessageId: msg.id });
            if (bodyText.length > 0 && isStopKeyword(bodyText)) {
              stopKeywordsDetected.push(msg.from);
            }
          }
        }
      }
    }

    await this.persistWebhook({
      tenantId,
      provider: 'meta',
      eventType: events.length > 0 ? events[0]?.status ?? 'unknown' : 'inbound',
      payload: parsedPayload as unknown as Record<string, unknown>,
      signatureValid: true,
      processedAt: new Date(),
      processedStatus: 'success',
      idempotencyKey,
    });

    return { status: 'processed', events, inboundMessages, stopKeywordsDetected };
  }

  private async persistWebhook(row: CommWebhookRow): Promise<void> {
    if (this.webhookRepo === undefined) return;
    try {
      await this.webhookRepo.save(row);
    } catch (err) {
      this.logger.error(`wa_webhook_persist_failed err=${(err as Error).message}`);
    }
  }
}
