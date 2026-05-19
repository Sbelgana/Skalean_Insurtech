export { CommTemplateEntity, type CommChannel, type CommTemplateCategory, type CommLanguage, type CommMetaTemplateStatus, type VariablesSchema } from './comm-template.entity.js';
export { CommMessageEntity, type CommDirection, type CommStatus, type CommProvider } from './comm-message.entity.js';
export { CommOptoutEntity } from './comm-optout.entity.js';
export { CommWebhookReceivedEntity, type CommWebhookProcessedStatus } from './comm-webhook-received.entity.js';

import { CommTemplateEntity } from './comm-template.entity.js';
import { CommMessageEntity } from './comm-message.entity.js';
import { CommOptoutEntity } from './comm-optout.entity.js';
import { CommWebhookReceivedEntity } from './comm-webhook-received.entity.js';

export const commEntities = [
  CommTemplateEntity,
  CommMessageEntity,
  CommOptoutEntity,
  CommWebhookReceivedEntity,
] as const;
