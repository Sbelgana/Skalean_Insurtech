/**
 * Zod schemas Pipeline + Stage -- Sprint 8 Tache 8.3.
 *
 * Validate inputs API : CreatePipelineDto / UpdatePipelineDto / CreateStageDto /
 * UpdateStageDto / ReorderStagesDto.
 *
 * Conformite v3.0 :
 *   - tenant_id automatique via TenantContext (pas dans schema input)
 *   - is_default unique partial index (DB layer enforce)
 *   - color hex format #RRGGBB (DB CHECK + Zod refine pour erreur clean)
 *   - win_probability 0-100 decimal (DB CHECK)
 *   - position int >= 0 (DB CHECK)
 *
 * Reference : B-08 Tache 3.1.3 + migration 1735000000016.
 */

import { z } from 'zod';

/** Hex color #RRGGBB strict. */
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const colorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, 'Color must be hex format #RRGGBB');

const winProbabilitySchema = z
  .number()
  .min(0, 'win_probability must be >= 0')
  .max(100, 'win_probability must be <= 100');

const positionSchema = z.number().int().min(0, 'position must be >= 0');

// ---------------------------------------------------------------------------
// Stage schemas
// ---------------------------------------------------------------------------

export const CreateStageSchema = z.object({
  name: z.string().min(1).max(100),
  position: positionSchema.optional(),
  color: colorSchema.default('#808080'),
  winProbability: winProbabilitySchema.default(0),
});

export type CreateStageDto = z.infer<typeof CreateStageSchema>;

export const UpdateStageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: positionSchema.optional(),
  color: colorSchema.optional(),
  winProbability: winProbabilitySchema.optional(),
});

export type UpdateStageDto = z.infer<typeof UpdateStageSchema>;

/** Reorder : batch update positions atomically in a transaction. */
export const ReorderStagesSchema = z.object({
  moves: z
    .array(
      z.object({
        stageId: z.string().uuid(),
        newPosition: positionSchema,
      }),
    )
    .min(1)
    .max(50),
});

export type ReorderStagesDto = z.infer<typeof ReorderStagesSchema>;

// ---------------------------------------------------------------------------
// Pipeline schemas
// ---------------------------------------------------------------------------

export const CreatePipelineSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).nullable().optional(),
  isDefault: z.boolean().default(false),
  /** Optional cascade : stages created atomically with the pipeline. */
  stages: z.array(CreateStageSchema).max(50).optional(),
});

export type CreatePipelineDto = z.infer<typeof CreatePipelineSchema>;

export const UpdatePipelineSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(2000).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export type UpdatePipelineDto = z.infer<typeof UpdatePipelineSchema>;

export const PipelineFiltersSchema = z.object({
  isDefault: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z.enum(['name', 'created_at', 'updated_at']).default('created_at'),
  orderDir: z.enum(['ASC', 'DESC']).default('DESC'),
});

export type PipelineFiltersDto = z.infer<typeof PipelineFiltersSchema>;
