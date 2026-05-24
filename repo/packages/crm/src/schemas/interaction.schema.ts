/**
 * Zod schemas Interaction -- Sprint 8 Tache 8.5.
 *
 * Validate inputs API : CreateInteractionDto / FilterInteractionsDto /
 * AnnotateInteractionDto. PAS de UpdateInteractionSchema (philosophie
 * Sprint 2 append-only -- DB triggers blockent UPDATE direct).
 *
 * Conformite v3.0 :
 *   - tenant_id automatique via TenantContext
 *   - Polymorphisme Option B : exactly one of companyId/contactId/dealId
 *   - type-dependent fields : duration (call/meeting), direction (call/email/whatsapp),
 *     status (meeting/call)
 *
 * Mutability model (Hybrid Sprint 8.5 / user-validated) :
 *   - INSERT : permis via service standard (CREATE permission)
 *   - UPDATE : interdit (trigger DB)
 *   - DELETE : interdit (trigger DB) ; soft-delete via SECURITY DEFINER func
 *   - Annotation : nouvelle interaction avec parent_interaction_id (pattern correction)
 *
 * Reference : B-08 Tache 3.1.5 + decision Hybrid SECURITY DEFINER.
 */

import { z } from 'zod';

/** Types reconnus par crm_interaction_type enum (DB Sprint 2 + 8.5). */
export const INTERACTION_TYPES = [
  'call',
  'email',
  'whatsapp',
  'meeting',
  'note',
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_DIRECTIONS = ['inbound', 'outbound'] as const;
export type InteractionDirection = (typeof INTERACTION_DIRECTIONS)[number];

export const INTERACTION_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'no_answer',
] as const;
export type InteractionStatus = (typeof INTERACTION_STATUSES)[number];

const interactionTypeSchema = z.enum(INTERACTION_TYPES);
const interactionDirectionSchema = z.enum(INTERACTION_DIRECTIONS);
const interactionStatusSchema = z.enum(INTERACTION_STATUSES);

/** Types autorises pour duration_minutes (CHECK DB). */
const TYPES_WITH_DURATION: readonly InteractionType[] = ['call', 'meeting'];

/** Types autorises pour direction (CHECK DB). */
const TYPES_WITH_DIRECTION: readonly InteractionType[] = [
  'call',
  'email',
  'whatsapp',
];

/** Types autorises pour status (CHECK DB). */
const TYPES_WITH_STATUS: readonly InteractionType[] = ['meeting', 'call'];

// ---------------------------------------------------------------------------
// Create -- with cross-field refinements
// ---------------------------------------------------------------------------

const baseCreateInteractionShape = z.object({
  interactionType: interactionTypeSchema,
  subject: z.string().min(1).max(300),
  body: z.string().max(50_000).optional(),
  occurredAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().min(0).max(60 * 24).optional(),
  direction: interactionDirectionSchema.optional(),
  status: interactionStatusSchema.optional(),
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  /** For annotate-pattern correction : reference an existing interaction. */
  parentInteractionId: z.string().uuid().optional(),
  /** Tenant-defined custom fields. Sprint 8 Task 8.14 (D3). */
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const CreateInteractionSchema = baseCreateInteractionShape
  .refine(
    (v) => {
      const set = [v.companyId, v.contactId, v.dealId].filter(
        (x) => x !== undefined && x !== null,
      ).length;
      return set === 1;
    },
    {
      message:
        'Exactement un de companyId / contactId / dealId doit etre fourni (polymorphic Option B).',
    },
  )
  .refine(
    (v) =>
      v.durationMinutes === undefined ||
      TYPES_WITH_DURATION.includes(v.interactionType),
    {
      message: 'durationMinutes uniquement pour interactionType IN (call, meeting).',
      path: ['durationMinutes'],
    },
  )
  .refine(
    (v) =>
      v.direction === undefined ||
      TYPES_WITH_DIRECTION.includes(v.interactionType),
    {
      message:
        'direction uniquement pour interactionType IN (call, email, whatsapp).',
      path: ['direction'],
    },
  )
  .refine(
    (v) =>
      v.status === undefined || TYPES_WITH_STATUS.includes(v.interactionType),
    {
      message: 'status uniquement pour interactionType IN (meeting, call).',
      path: ['status'],
    },
  );

export type CreateInteractionDto = z.infer<typeof CreateInteractionSchema>;

// ---------------------------------------------------------------------------
// Annotate -- syntactic sugar over create with mandatory parent
// ---------------------------------------------------------------------------

export const AnnotateInteractionSchema = z.object({
  /** Free-text annotation body (the actual correction/note). */
  body: z.string().min(1).max(50_000),
  subject: z.string().min(1).max(300).default('Annotation'),
});

export type AnnotateInteractionDto = z.infer<typeof AnnotateInteractionSchema>;

// ---------------------------------------------------------------------------
// Filters / pagination
// ---------------------------------------------------------------------------

export const FilterInteractionsSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  interactionType: interactionTypeSchema.optional(),
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  occurredFrom: z.coerce.date().optional(),
  occurredTo: z.coerce.date().optional(),
  /** Include soft-deleted records (default false). */
  includeDeleted: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z.enum(['occurred_at', 'created_at']).default('occurred_at'),
  orderDir: z.enum(['ASC', 'DESC']).default('DESC'),
});

export type FilterInteractionsDto = z.infer<typeof FilterInteractionsSchema>;

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export const TimelineQuerySchema = z.object({
  /** Optional type filter for the aggregated timeline. */
  interactionType: interactionTypeSchema.optional(),
  occurredFrom: z.coerce.date().optional(),
  occurredTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TimelineQueryDto = z.infer<typeof TimelineQuerySchema>;
