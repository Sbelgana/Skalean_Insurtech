/**
 * Zod schemas Deal -- Sprint 8 Tache 8.4.
 *
 * Validate inputs API : CreateDealDto / UpdateDealDto / MoveToStageDto /
 * CloseDealDto / ReopenDealDto / DealFiltersDto.
 *
 * Conformite v3.0 :
 *   - tenant_id automatique via TenantContext (pas dans schema input)
 *   - companyId obligatoire (Task 8.4 spec : preserver lien client commercial)
 *   - contactId optional (peut etre supprime via FK SET NULL)
 *   - pipelineId + stageId obligatoires sur create -- stageId auto-pick first
 *     stage of pipeline si non-fourni (service-side)
 *   - currency ISO 4217 (MAD/EUR/USD pour pilote MA)
 *   - amount numeric(15,2), default 0, >= 0
 *
 * Immutabilites :
 *   - companyId : NON modifiable via UpdateDeal (changement de client = nouveau deal)
 *   - pipelineId : NON modifiable via UpdateDeal (migration pipeline = workflow surgery)
 *   - stageId : NON modifiable via UpdateDeal -> utiliser MoveToStage
 *
 * Reference : B-08 Tache 3.1.4.
 */

import { z } from 'zod';

/** Currencies ISO 4217 supportees v3.0 (extensible plus tard). */
export const DEAL_CURRENCIES = ['MAD', 'EUR', 'USD'] as const;
export type DealCurrency = (typeof DEAL_CURRENCIES)[number];

const currencySchema = z.enum(DEAL_CURRENCIES).default('MAD');
const amountSchema = z
  .number()
  .nonnegative('amount must be >= 0')
  .max(999_999_999_999_999.99, 'amount exceeds numeric(15,2) precision');

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const CreateDealSchema = z.object({
  companyId: z.string().uuid(),
  contactId: z.string().uuid().nullable().optional(),
  pipelineId: z.string().uuid(),
  /** If omitted, service picks the first stage (position=min) of the pipeline. */
  stageId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  amount: amountSchema.default(0),
  currency: currencySchema,
  expectedCloseDate: z.coerce.date().optional(),
  ownerUserId: z.string().uuid(),
  description: z.string().max(5000).nullable().optional(),
  /** Tenant-defined custom fields. Sprint 8 Task 8.14 (D3). */
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type CreateDealDto = z.infer<typeof CreateDealSchema>;

// ---------------------------------------------------------------------------
// Update -- non-stage fields only
// ---------------------------------------------------------------------------

export const UpdateDealSchema = z.object({
  /** contactId can be set to null to unlink. */
  contactId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  amount: amountSchema.optional(),
  currency: z.enum(DEAL_CURRENCIES).optional(),
  expectedCloseDate: z.coerce.date().nullable().optional(),
  ownerUserId: z.string().uuid().optional(),
  description: z.string().max(5000).nullable().optional(),
  /** Tenant-defined custom fields. Sprint 8 Task 8.14 (D3). */
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateDealDto = z.infer<typeof UpdateDealSchema>;

// ---------------------------------------------------------------------------
// Move to stage (workflow transition)
// ---------------------------------------------------------------------------

export const MoveToStageSchema = z.object({
  stageId: z.string().uuid(),
  /** Free-text reason for the transition. Stored in audit log. Optional. */
  reason: z.string().max(500).optional(),
});

export type MoveToStageDto = z.infer<typeof MoveToStageSchema>;

// ---------------------------------------------------------------------------
// Close deal (won or lost)
// ---------------------------------------------------------------------------

export const CloseDealSchema = z.object({
  /** If provided, overrides deal.amount at close time (e.g. final negotiated amount). */
  actualAmount: amountSchema.optional(),
  /** Free-text reason. Stored in audit log + description if no description set. */
  reason: z.string().max(2000).optional(),
});

export type CloseDealDto = z.infer<typeof CloseDealSchema>;

// ---------------------------------------------------------------------------
// Reopen deal (admin only -- CRM_DEALS_OVERRIDE_WORKFLOW)
// ---------------------------------------------------------------------------

export const ReopenDealSchema = z.object({
  /** Target stage to move the deal back to. If omitted, first stage of pipeline. */
  stageId: z.string().uuid().optional(),
  /** Mandatory reason for reopen (compliance audit trail). */
  reason: z.string().min(5).max(2000),
});

export type ReopenDealDto = z.infer<typeof ReopenDealSchema>;

// ---------------------------------------------------------------------------
// Filters / pagination
// ---------------------------------------------------------------------------

const dealStatusSchema = z.enum(['open', 'won', 'lost', 'all']).default('all');

export const DealFiltersSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  status: dealStatusSchema,
  closedFrom: z.coerce.date().optional(),
  closedTo: z.coerce.date().optional(),
  expectedCloseFrom: z.coerce.date().optional(),
  expectedCloseTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z
    .enum(['name', 'amount', 'created_at', 'updated_at', 'expected_close_date'])
    .default('created_at'),
  orderDir: z.enum(['ASC', 'DESC']).default('DESC'),
});

export type DealFiltersDto = z.infer<typeof DealFiltersSchema>;
