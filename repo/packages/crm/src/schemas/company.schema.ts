/**
 * Zod schemas Company -- Sprint 8 Tache 8.1.
 *
 * Validate inputs API : CreateCompanyDto / UpdateCompanyDto / CompanyFiltersDto.
 *
 * Conformite v3.0 :
 *   - tenant_id automatique via TenantContext (pas dans schema input)
 *   - ICE optional mais si fourni validation stricte 15 digits + checksum DGI
 *   - RC + Patente optional (registre commerce + patente fiscale MA)
 *   - country default MA
 *
 * Reference : B-08 Tache 3.1.1.
 */

import { z } from 'zod';
import { ICE_VALIDATION_MESSAGE, iceRefinement } from '../validators/ice.validator.js';

/** Schema email leger MA (citext en DB) -- accepte tous emails ASCII. */
const emailSchema = z.string().email('Email invalide').max(320);

/** Schema phone simple : accept E.164 ou local MA (validation stricte Sprint 8.2 phone-ma.validator). */
const phoneSchema = z
  .string()
  .min(8)
  .max(20)
  .regex(/^[+]?[\d\s()-]+$/, 'Format telephone invalide');

/** Schema ICE optional avec refine (15 digits + checksum). */
const iceSchema = z.string().refine(iceRefinement, { message: ICE_VALIDATION_MESSAGE });

export const CreateCompanySchema = z.object({
  name: z.string().min(2).max(200),
  industry: z.string().max(100).optional(),
  ice: iceSchema.optional(),
  rc: z.string().max(50).optional(),
  patente: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().length(2).default('MA'),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  website: z.string().url().max(500).optional(),
  ownerUserId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  notes: z.string().max(5000).optional(),
  /**
   * Tenant-defined custom fields. Validated at runtime by
   * CustomFieldsValidatorService against `crm_custom_field_definitions`
   * for entityType='company'. Sprint 8 Task 8.14 (D3).
   */
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>;

export const UpdateCompanySchema = CreateCompanySchema.partial();
export type UpdateCompanyDto = z.infer<typeof UpdateCompanySchema>;

export const CompanyFiltersSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  industry: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  ownerUserId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z.enum(['name', 'created_at', 'updated_at']).default('created_at'),
  orderDir: z.enum(['ASC', 'DESC']).default('DESC'),
});

export type CompanyFiltersDto = z.infer<typeof CompanyFiltersSchema>;
