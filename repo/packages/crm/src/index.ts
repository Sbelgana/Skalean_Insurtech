/**
 * @insurtech/crm -- CRM package (Sprint 8 -- Phase 3 Sprint 1).
 *
 * Exporte validators MA (ICE / CIN / Phone), Zod schemas, types.
 * Services NestJS implementes dans apps/api/src/modules/crm/.
 */

export const CRM_PACKAGE_VERSION = '0.2.0';

// Validators MA
export {
  ICE_REGEX,
  ICE_VALIDATION_MESSAGE,
  validateIce,
  formatIce,
  iceRefinement,
  type IceValidationError,
  type IceValidationResult,
} from './validators/ice.validator.js';

// Schemas Zod Company
export {
  CreateCompanySchema,
  UpdateCompanySchema,
  CompanyFiltersSchema,
  type CreateCompanyDto,
  type UpdateCompanyDto,
  type CompanyFiltersDto,
} from './schemas/company.schema.js';
