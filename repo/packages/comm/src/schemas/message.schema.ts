/**
 * @insurtech/comm/schemas/message.schema
 *
 * Zod schemas CRUD pour Communications messages Sprint 9.
 * Source-of-truth runtime + compile-time (z.infer).
 */

import { z } from 'zod';
import { CHANNELS, DIRECTIONS, LOCALES, MESSAGE_STATUSES } from '../types/channel.enum.js';

// ============================================================
// Validators primitifs
// ============================================================

export const PhoneE164 = z
  .string()
  .regex(/^\+\d{8,15}$/, { message: 'PHONE_NOT_E164' });

export const Email = z
  .string()
  .min(3)
  .max(320)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: 'EMAIL_INVALID' });

export const PhoneOrEmail = z.union([PhoneE164, Email]);

export const TenantId = z.string().uuid({ message: 'TENANT_ID_INVALID' });
export const ContactId = z.string().uuid({ message: 'CONTACT_ID_INVALID' });
export const TemplateId = z.string().uuid({ message: 'TEMPLATE_ID_INVALID' });
export const MessageId = z.string().uuid({ message: 'MESSAGE_ID_INVALID' });

export const TemplateVariables = z.record(z.string(), z.unknown()).default({});

// ============================================================
// SendMessageSchema -- input principal pour orchestrator Sprint 9 Tache 3.2.9
// ============================================================

export const SendMessageSchema = z
  .object({
    contactId: ContactId.optional(),
    toAddress: PhoneOrEmail.optional(),
    channel: z.enum(CHANNELS).optional(),
    templateName: z.string().min(1).max(255),
    locale: z.enum(LOCALES).default('fr'),
    variables: TemplateVariables,
    replyTo: PhoneOrEmail.optional(),
    correlationId: z.string().uuid().optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .refine((data) => data.contactId !== undefined || data.toAddress !== undefined, {
    message: 'EITHER_CONTACT_ID_OR_TO_ADDRESS_REQUIRED',
    path: ['contactId'],
  });

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

// ============================================================
// MessageFiltersSchema -- queries paginated Sprint 9 Tache 3.2.12
// ============================================================

export const MessageFiltersSchema = z.object({
  channel: z.enum(CHANNELS).optional(),
  direction: z.enum(DIRECTIONS).optional(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  contactId: ContactId.optional(),
  templateId: TemplateId.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().max(255).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type MessageFiltersInput = z.infer<typeof MessageFiltersSchema>;

// ============================================================
// BatchSendSchema -- bulk send Sprint 9 Tache 3.2.9
// ============================================================

export const BatchSendItemSchema = z.object({
  contactId: ContactId,
  variables: TemplateVariables,
  correlationId: z.string().uuid().optional(),
});

export const BatchSendSchema = z.object({
  templateName: z.string().min(1).max(255),
  locale: z.enum(LOCALES).default('fr'),
  items: z.array(BatchSendItemSchema).min(1).max(1000),
  preferChannel: z.enum(CHANNELS).optional(),
});

export type BatchSendInput = z.infer<typeof BatchSendSchema>;
export type BatchSendItem = z.infer<typeof BatchSendItemSchema>;

// ============================================================
// UpdateStatusSchema -- transitions status Sprint 9 Tache 3.2.10
// ============================================================

export const UpdateStatusSchema = z
  .object({
    messageId: MessageId,
    status: z.enum(MESSAGE_STATUSES),
    providerMessageId: z.string().min(1).max(255).optional(),
    sentAt: z.coerce.date().optional(),
    deliveredAt: z.coerce.date().optional(),
    readAt: z.coerce.date().optional(),
    failedAt: z.coerce.date().optional(),
    failReason: z.string().max(2048).optional(),
    force: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.status === 'failed' || data.status === 'bounced') {
        return data.failReason !== undefined && data.failReason.length > 0;
      }
      return true;
    },
    { message: 'FAILED_REQUIRES_REASON', path: ['failReason'] },
  );

export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

// ============================================================
// CreateMessageRowSchema -- input direct pour repository Sprint 9 Tache 3.2.9
// ============================================================

export const CreateMessageRowSchema = z.object({
  tenantId: TenantId,
  contactId: ContactId.nullable(),
  channel: z.enum(CHANNELS),
  direction: z.enum(DIRECTIONS),
  toAddress: z.string().min(1).max(320),
  fromAddress: z.string().min(1).max(320),
  subject: z.string().max(998).nullable(),
  body: z.string().min(1),
  templateId: TemplateId.nullable(),
  templateVariables: TemplateVariables,
  status: z.enum(MESSAGE_STATUSES).default('pending'),
  provider: z.enum(['meta', 'twilio', 'sendgrid', 'mailgun']),
  providerMessageId: z.string().max(255).nullable().optional(),
});

export type CreateMessageRow = z.infer<typeof CreateMessageRowSchema>;
