/**
 * Zod schemas for iCal feed subscription tokens -- Sprint 8 Tache 8.13.
 *
 * Token lifecycle :
 *   1. User POST /booking/calendar/ical-tokens { scope, name, expiresAt? }
 *      -> server generates plain token (32 random bytes base64url), persists
 *      ONLY the SHA-256 hash, returns the plain token ONCE in feedUrl.
 *   2. iCal client (Apple Calendar / Outlook / Google Calendar) subscribes by
 *      URL : GET /booking/calendar/ical/{plainToken}.ics
 *   3. User DELETE /booking/calendar/ical-tokens/:id -> soft-delete (active=false).
 */

import { z } from 'zod';

export const ICAL_TOKEN_SCOPES = ['own', 'team', 'all_tenant'] as const;
export type IcalTokenScope = (typeof ICAL_TOKEN_SCOPES)[number];

export const IcalTokenScopeSchema = z.enum(ICAL_TOKEN_SCOPES);

/**
 * Inbound DTO for POST /booking/calendar/ical-tokens.
 *   - `name` : free-form label (e.g. "iPhone Calendar")
 *   - `scope` : own (default) | team | all_tenant
 *   - `expiresAt` : optional ISO datetime ; must be future
 */
export const CreateIcalTokenSchema = z
  .object({
    name: z.string().trim().min(1, 'name required').max(150),
    scope: IcalTokenScopeSchema.default('own'),
    expiresAt: z
      .union([z.string().datetime(), z.date()])
      .optional()
      .transform((v) => (v === undefined ? undefined : new Date(v))),
  })
  .refine(
    (data) => !data.expiresAt || data.expiresAt.getTime() > Date.now(),
    { message: 'expiresAt must be in the future', path: ['expiresAt'] },
  );
export type CreateIcalTokenDto = z.infer<typeof CreateIcalTokenSchema>;

/**
 * Response shape for POST (creation only) -- includes feedUrl with plain token.
 * The plain token is NEVER returned again ; the user must save feedUrl now.
 */
export const IcalTokenCreatedSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  scope: IcalTokenScopeSchema,
  /** Full subscribe URL including plain token. Shown ONCE. */
  feedUrl: z.string().url(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type IcalTokenCreatedDto = z.infer<typeof IcalTokenCreatedSchema>;

/**
 * Response shape for listing endpoints (GET) -- never exposes plain token.
 * UI shows scope / name / usage stats only.
 */
export const IcalTokenSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  scope: IcalTokenScopeSchema,
  expiresAt: z.string().datetime().nullable(),
  lastAccessedAt: z.string().datetime().nullable(),
  accessCount: z.number().int().nonnegative(),
  active: z.boolean(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type IcalTokenSummaryDto = z.infer<typeof IcalTokenSummarySchema>;
