/**
 * @insurtech/comm/schemas/webhook.schema
 *
 * Zod discriminated union pour webhooks providers Meta WhatsApp + Mailgun.
 * Sprint 9 Tache 3.2.4 (WA) + 3.2.10 (Mailgun) consomment ces schemas.
 */

import { z } from 'zod';

// ============================================================
// Meta WhatsApp webhook payload (Cloud API v21.0)
// ============================================================

const MetaStatusEnum = z.enum(['sent', 'delivered', 'read', 'failed']);

const MetaStatusEntrySchema = z.object({
  id: z.string(),
  status: MetaStatusEnum,
  timestamp: z.string(),
  recipient_id: z.string(),
  errors: z
    .array(
      z.object({
        code: z.number(),
        title: z.string(),
        message: z.string().optional(),
      }),
    )
    .optional(),
});

const MetaIncomingMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
});

const MetaChangeValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  statuses: z.array(MetaStatusEntrySchema).optional(),
  messages: z.array(MetaIncomingMessageSchema).optional(),
});

export const MetaWebhookSchema = z.object({
  provider: z.literal('meta'),
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.literal('messages'),
          value: MetaChangeValueSchema,
        }),
      ),
    }),
  ),
});

// ============================================================
// Mailgun webhook payload (event-based webhook v3)
// ============================================================

const MailgunEventEnum = z.enum([
  'delivered',
  'failed',
  'bounced',
  'opened',
  'clicked',
  'unsubscribed',
  'complained',
]);

export const MailgunWebhookSchema = z.object({
  provider: z.literal('mailgun'),
  signature: z.object({
    timestamp: z.string(),
    token: z.string(),
    signature: z.string(),
  }),
  'event-data': z.object({
    event: MailgunEventEnum,
    id: z.string(),
    timestamp: z.number(),
    severity: z.enum(['permanent', 'temporary']).optional(),
    reason: z.string().optional(),
    message: z.object({
      headers: z.object({
        'message-id': z.string(),
      }),
    }),
  }),
});

// ============================================================
// Discriminated union
// ============================================================

export const WebhookEventSchema = z.discriminatedUnion('provider', [
  MetaWebhookSchema,
  MailgunWebhookSchema,
]);

export type WebhookEventInput = z.infer<typeof WebhookEventSchema>;
export type MetaWebhookPayload = z.infer<typeof MetaWebhookSchema>;
export type MailgunWebhookPayload = z.infer<typeof MailgunWebhookSchema>;
