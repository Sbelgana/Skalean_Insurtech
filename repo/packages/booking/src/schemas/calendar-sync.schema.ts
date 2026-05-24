/**
 * Zod schemas Calendar Sync -- Sprint 8 Tache 8.10 (foundation only).
 *
 * Foundation scope (user-validated Option A) :
 *   - DB persistence + AES-256-GCM encryption (transparent via Sprint 2
 *     TypeORM ValueTransformer) + webhook tracking columns
 *   - PAS de Provider services (googleapis / MS Graph SDK) ni Controller
 *     OAuth flow ni Webhook receivers : deferred Task 8.10b / Sprint 8.14
 *     quand dev credentials disponibles + public callback URL accessible.
 *
 * Reference : B-08 Tache 3.2.3 (foundation).
 */

import { z } from 'zod';

export const CALENDAR_PROVIDERS = ['google', 'outlook', 'caldav'] as const;
export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number];
export const CalendarProviderSchema = z.enum(CALENDAR_PROVIDERS);

export const CALENDAR_SYNC_STATUSES = ['success', 'partial', 'failed'] as const;
export type CalendarSyncStatus = (typeof CALENDAR_SYNC_STATUSES)[number];
export const CalendarSyncStatusSchema = z.enum(CALENDAR_SYNC_STATUSES);

/**
 * Input to persist OAuth tokens after exchange. Plaintext fields ; persistence
 * layer encrypts transparently via ValueTransformer.
 */
export const SaveCalendarTokensSchema = z.object({
  provider: CalendarProviderSchema,
  providerAccountId: z.string().min(1).max(255),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  tokenExpiresAt: z.coerce.date().nullable().optional(),
  scope: z.string().max(500).optional(),
});
export type SaveCalendarTokensDto = z.infer<typeof SaveCalendarTokensSchema>;

/**
 * Updates a webhook subscription association (Task 8.10b real OAuth flow
 * populates these after successful subscription creation against Google /
 * MS Graph APIs).
 */
export const SaveWebhookSubscriptionSchema = z.object({
  webhookSubscriptionId: z.string().min(1).max(300),
  webhookResourceId: z.string().min(1).max(300).optional(),
  webhookExpiresAt: z.coerce.date(),
});
export type SaveWebhookSubscriptionDto = z.infer<typeof SaveWebhookSubscriptionSchema>;

export const RecordSyncOutcomeSchema = z.object({
  status: CalendarSyncStatusSchema,
  error: z.string().max(500).optional(),
});
export type RecordSyncOutcomeDto = z.infer<typeof RecordSyncOutcomeSchema>;

/** Filters for listing user connections (Task 8.10b controller). */
export const FilterCalendarSyncsSchema = z.object({
  provider: CalendarProviderSchema.optional(),
  enabledOnly: z.coerce.boolean().default(true),
});
export type FilterCalendarSyncsDto = z.infer<typeof FilterCalendarSyncsSchema>;

/**
 * Connection info (no plaintext tokens / no encrypted ciphertext leaked).
 * Used by future listConnections() controller endpoint Task 8.10b.
 */
export const ConnectionInfoSchema = z.object({
  id: z.string().uuid(),
  provider: CalendarProviderSchema,
  providerAccountId: z.string(),
  syncEnabled: z.boolean(),
  scope: z.string().nullable(),
  tokenExpiresAt: z.date().nullable(),
  lastSyncAt: z.date().nullable(),
  lastSyncStatus: CalendarSyncStatusSchema.nullable(),
  lastSyncError: z.string().nullable(),
  webhookExpiresAt: z.date().nullable(),
  consecutiveFailures: z.number().int(),
});
export type ConnectionInfoDto = z.infer<typeof ConnectionInfoSchema>;
