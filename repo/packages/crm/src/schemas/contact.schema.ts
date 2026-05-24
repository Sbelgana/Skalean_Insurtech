/**
 * Zod schemas Contact -- Sprint 8 Tache 8.2.
 *
 * Validate inputs API : CreateContactDto / UpdateContactDto / ContactFiltersDto.
 *
 * Conformite v3.0 :
 *   - tenant_id automatique via TenantContext (pas dans schema input)
 *   - CIN optional, mais si fourni validation MA stricte (regex DGSN)
 *   - phone optional, mais si fourni validation E.164 mobile MA (+212 5/6/7)
 *   - email optional, citext en DB, unique par tenant si non null (CHECK migration Sprint 2)
 *   - preferred_language : 'fr' | 'ar-MA' | 'ar' (defaut 'fr')
 *   - preferred_channel : 'whatsapp' | 'email' | 'sms' | 'voice' (defaut 'email')
 *
 * Reference : B-08 Tache 3.1.2.
 */

import { z } from 'zod';
import { CIN_VALIDATION_MESSAGE, cinRefinement } from '../validators/cin.validator.js';
import {
  PHONE_MA_VALIDATION_MESSAGE,
  phoneMaRefinement,
} from '../validators/phone-ma.validator.js';

/** Schema email leger MA (citext en DB) -- accepte tous emails ASCII. */
const emailSchema = z.string().email('Email invalide').max(320);

/** Schema phone MA strict : valide E.164 mobile MA apres normalisation. */
const phoneSchema = z
  .string()
  .min(8)
  .max(25)
  .refine(phoneMaRefinement, { message: PHONE_MA_VALIDATION_MESSAGE });

/** Schema CIN MA strict : 1-2 lettres + 6-8 digits. */
const cinSchema = z.string().refine(cinRefinement, { message: CIN_VALIDATION_MESSAGE });

const preferredLanguageSchema = z.enum(['fr', 'ar-MA', 'ar']).default('fr');
const preferredChannelSchema = z
  .enum(['whatsapp', 'email', 'sms', 'voice'])
  .default('email');

export const CreateContactSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  cin: cinSchema.optional(),
  preferredLanguage: preferredLanguageSchema,
  preferredChannel: preferredChannelSchema,
  tags: z.array(z.string().max(50)).max(20).default([]),
  notes: z.string().max(5000).optional(),
  /** Tenant-defined custom fields. Sprint 8 Task 8.14 (D3). */
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type CreateContactDto = z.infer<typeof CreateContactSchema>;

/**
 * Update schema -- supports clearing optional MA fields by passing null.
 * cin/phone/email/companyId/notes can be set to null to clear them.
 */
export const UpdateContactSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: emailSchema.nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  cin: cinSchema.nullable().optional(),
  preferredLanguage: z.enum(['fr', 'ar-MA', 'ar']).optional(),
  preferredChannel: z.enum(['whatsapp', 'email', 'sms', 'voice']).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).nullable().optional(),
  /** Tenant-defined custom fields. Sprint 8 Task 8.14 (D3). */
  customFields: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;

export const ContactFiltersSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  companyId: z.string().uuid().optional(),
  preferredLanguage: z.enum(['fr', 'ar-MA', 'ar']).optional(),
  preferredChannel: z.enum(['whatsapp', 'email', 'sms', 'voice']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z
    .enum(['last_name', 'first_name', 'created_at', 'updated_at'])
    .default('created_at'),
  orderDir: z.enum(['ASC', 'DESC']).default('DESC'),
});

export type ContactFiltersDto = z.infer<typeof ContactFiltersSchema>;

/** Schema link/unlink to company. */
export const LinkContactToCompanySchema = z.object({
  companyId: z.string().uuid().nullable(),
});

export type LinkContactToCompanyDto = z.infer<typeof LinkContactToCompanySchema>;
