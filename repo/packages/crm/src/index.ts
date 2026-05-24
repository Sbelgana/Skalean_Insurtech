/**
 * @insurtech/crm -- CRM package (Sprint 8 -- Phase 3 Sprint 1).
 *
 * Exporte validators MA (ICE / CIN / Phone), Zod schemas, types.
 * Services NestJS implementes dans apps/api/src/modules/crm/.
 */

export const CRM_PACKAGE_VERSION = '0.5.0';

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

export {
  CIN_REGEX,
  CIN_VALIDATION_MESSAGE,
  validateCin,
  cinRefinement,
  type CinValidationError,
  type CinValidationResult,
} from './validators/cin.validator.js';

export {
  PHONE_MA_REGEX,
  PHONE_MA_VALIDATION_MESSAGE,
  normalizePhoneMa,
  validatePhoneMa,
  phoneMaRefinement,
  type PhoneMaValidationError,
  type PhoneMaValidationResult,
} from './validators/phone-ma.validator.js';

// Schemas Zod Company
export {
  CreateCompanySchema,
  UpdateCompanySchema,
  CompanyFiltersSchema,
  type CreateCompanyDto,
  type UpdateCompanyDto,
  type CompanyFiltersDto,
} from './schemas/company.schema.js';

// Schemas Zod Contact (Sprint 8 Tache 8.2)
export {
  CreateContactSchema,
  UpdateContactSchema,
  ContactFiltersSchema,
  LinkContactToCompanySchema,
  type CreateContactDto,
  type UpdateContactDto,
  type ContactFiltersDto,
  type LinkContactToCompanyDto,
} from './schemas/contact.schema.js';

// Schemas Zod Pipeline + Stage (Sprint 8 Tache 8.3)
export {
  HEX_COLOR_REGEX,
  CreatePipelineSchema,
  UpdatePipelineSchema,
  PipelineFiltersSchema,
  CreateStageSchema,
  UpdateStageSchema,
  ReorderStagesSchema,
  type CreatePipelineDto,
  type UpdatePipelineDto,
  type PipelineFiltersDto,
  type CreateStageDto,
  type UpdateStageDto,
  type ReorderStagesDto,
} from './schemas/pipeline.schema.js';

// Schemas Zod Deal (Sprint 8 Tache 8.4)
export {
  DEAL_CURRENCIES,
  CreateDealSchema,
  UpdateDealSchema,
  MoveToStageSchema,
  CloseDealSchema,
  ReopenDealSchema,
  DealFiltersSchema,
  type DealCurrency,
  type CreateDealDto,
  type UpdateDealDto,
  type MoveToStageDto,
  type CloseDealDto,
  type ReopenDealDto,
  type DealFiltersDto,
} from './schemas/deal.schema.js';
