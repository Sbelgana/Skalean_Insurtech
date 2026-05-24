/**
 * Zod schemas Custom Fields -- Sprint 8 Tache 8.7.
 *
 * Definitions metadata per tenant. The actual values stored in
 * `crm_*.custom_fields jsonb` are validated at runtime via
 * CustomFieldsValidatorService which builds a Zod schema from active
 * definitions.
 *
 * Mutability :
 *   - entityType + fieldKey : IMMUTABLE post-create (changement = renommage
 *     destructeur ; delete + create est la voie propre)
 *   - Tous les autres fields : mutable via UpdateFieldDefinitionSchema
 *
 * Reference : B-08 Tache 3.1.7.
 */

import { z } from 'zod';

export const CUSTOM_FIELD_ENTITY_TYPES = [
  'company',
  'contact',
  'deal',
  'interaction',
] as const;
export type CustomFieldEntityTypeDto = (typeof CUSTOM_FIELD_ENTITY_TYPES)[number];

export const CUSTOM_FIELD_TYPES = [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multiselect',
  'url',
  'email',
] as const;
export type CustomFieldTypeDto = (typeof CUSTOM_FIELD_TYPES)[number];

export const EntityTypeSchema = z.enum(CUSTOM_FIELD_ENTITY_TYPES);
export const FieldTypeSchema = z.enum(CUSTOM_FIELD_TYPES);

/** Snake_case key : starts with lowercase letter, then [a-z0-9_]{0,48}. */
export const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,48}$/;

export const CustomFieldOptionSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(150),
});
export type CustomFieldOptionDto = z.infer<typeof CustomFieldOptionSchema>;

export const ValidationRulesSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    pattern: z.string().max(500).optional(),
  })
  .optional()
  .default({});
export type ValidationRulesDto = z.infer<typeof ValidationRulesSchema>;

// ---------------------------------------------------------------------------
// Create / Update
// ---------------------------------------------------------------------------

const baseCreateShape = {
  entityType: EntityTypeSchema,
  fieldKey: z
    .string()
    .regex(
      FIELD_KEY_REGEX,
      'fieldKey must be snake_case starting with a lowercase letter (1-49 chars)',
    ),
  fieldLabel: z.string().min(1).max(150),
  fieldType: FieldTypeSchema,
  options: z.array(CustomFieldOptionSchema).max(100).optional(),
  validationRules: ValidationRulesSchema,
  required: z.boolean().optional().default(false),
  displayOrder: z.number().int().min(0).optional().default(0),
  description: z.string().max(1000).optional(),
};

export const CreateFieldDefinitionSchema = z.object(baseCreateShape).refine(
  (data) => {
    // select / multiselect require options
    if (
      (data.fieldType === 'select' || data.fieldType === 'multiselect') &&
      (!data.options || data.options.length === 0)
    ) {
      return false;
    }
    return true;
  },
  {
    message: 'options is required for fieldType select/multiselect',
    path: ['options'],
  },
);

export type CreateFieldDefinitionDto = z.infer<typeof CreateFieldDefinitionSchema>;

/**
 * Update schema -- entityType + fieldKey are immutable (changement = destructeur).
 * Other fields nullable.optional() for partial update.
 */
/** Validation rules for Update -- truly optional (no .default()) to keep the
 * input/output types properly optional in the inferred Dto. */
const ValidationRulesPartialSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    pattern: z.string().max(500).optional(),
  })
  .optional();

export const UpdateFieldDefinitionSchema = z.object({
  fieldLabel: z.string().min(1).max(150).optional(),
  fieldType: FieldTypeSchema.optional(),
  options: z.array(CustomFieldOptionSchema).max(100).nullable().optional(),
  validationRules: ValidationRulesPartialSchema,
  required: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  description: z.string().max(1000).nullable().optional(),
});
export type UpdateFieldDefinitionDto = z.infer<typeof UpdateFieldDefinitionSchema>;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const FieldDefinitionFiltersSchema = z.object({
  entityType: EntityTypeSchema.optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type FieldDefinitionFiltersDto = z.infer<typeof FieldDefinitionFiltersSchema>;
