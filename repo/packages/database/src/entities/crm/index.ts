export { CrmCompanyEntity } from './crm-company.entity.js';
export { CrmContactEntity, type CrmPreferredLanguage, type CrmPreferredChannel } from './crm-contact.entity.js';
export { CrmDealEntity, type CrmDealStage } from './crm-deal.entity.js';
export { CrmInteractionEntity, type CrmInteractionType, type CrmInteractionDirection, type CrmInteractionStatus } from './crm-interaction.entity.js';
export { CrmPipelineEntity } from './crm-pipeline.entity.js';
export { CrmStageEntity } from './crm-stage.entity.js';
export {
  CrmCustomFieldDefinitionEntity,
  type CustomFieldEntityType,
  type CustomFieldType,
  type CustomFieldOption,
  type CustomFieldValidationRules,
} from './crm-custom-field-definition.entity.js';

import { CrmCompanyEntity } from './crm-company.entity.js';
import { CrmContactEntity } from './crm-contact.entity.js';
import { CrmDealEntity } from './crm-deal.entity.js';
import { CrmInteractionEntity } from './crm-interaction.entity.js';
import { CrmPipelineEntity } from './crm-pipeline.entity.js';
import { CrmStageEntity } from './crm-stage.entity.js';
import { CrmCustomFieldDefinitionEntity } from './crm-custom-field-definition.entity.js';

export const crmEntities = [
  CrmCompanyEntity,
  CrmContactEntity,
  CrmDealEntity,
  CrmInteractionEntity,
  CrmPipelineEntity,
  CrmStageEntity,
  CrmCustomFieldDefinitionEntity,
] as const;
