export { CrmCompanyEntity } from './crm-company.entity.js';
export { CrmContactEntity, type CrmPreferredLanguage, type CrmPreferredChannel } from './crm-contact.entity.js';
export { CrmDealEntity, type CrmDealStage } from './crm-deal.entity.js';
export { CrmInteractionEntity, type CrmInteractionType, type CrmInteractionDirection } from './crm-interaction.entity.js';

import { CrmCompanyEntity } from './crm-company.entity.js';
import { CrmContactEntity } from './crm-contact.entity.js';
import { CrmDealEntity } from './crm-deal.entity.js';
import { CrmInteractionEntity } from './crm-interaction.entity.js';

export const crmEntities = [CrmCompanyEntity, CrmContactEntity, CrmDealEntity, CrmInteractionEntity] as const;
