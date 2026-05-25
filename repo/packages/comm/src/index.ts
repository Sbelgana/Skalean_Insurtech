/**
 * @insurtech/comm
 *
 * Sprint 5 Tache 2.1.13 :
 *   - NodemailerEmailService (SMTP transport)
 *   - Handlebars templates (verify / recovery / password-changed)
 *   - 4 locales : fr-MA, fr-FR, ar-MA, en
 *
 * Sprint 9 Tache 3.2.1+ :
 *   - Types canoniques (Channel, Locale, MessageStatus, Provider)
 *   - Schemas Zod CRUD + webhook discriminated union
 *   - Helpers normalisation phone E.164 + email RFC 5322
 *   - MessagesRepositoryService (DataMapper pattern + STATUS_TRANSITIONS guard)
 *   - Errors metier (InvalidStatusTransitionError, MessageNotFoundError, ...)
 */

export const VERSION = '0.2.0';

// Sprint 5 heritage
export { NodemailerEmailService } from './nodemailer-email.service.js';
export type {
  SendVerificationInput,
  SendRecoveryInput,
  SendPasswordChangedInput,
} from './nodemailer-email.service.js';
export {
  renderVerify,
  renderRecovery,
  renderPasswordChanged,
  VERIFY_TEMPLATES,
  RECOVERY_TEMPLATES,
  PASSWORD_CHANGED_TEMPLATES,
} from './templates.js';
export type { EmailLocale } from './templates.js';

// Sprint 9 types
export {
  CHANNELS,
  DIRECTIONS,
  MESSAGE_STATUSES,
  PROVIDERS,
  LOCALES,
  META_LOCALE_MAP,
} from './types/channel.enum.js';
export type {
  Channel,
  Direction,
  MessageStatus,
  Provider,
  Locale,
} from './types/channel.enum.js';

export type {
  CommMessage,
  MessageVariables,
  MessageTimelineEntry,
  PaginationCursor,
  PaginatedResult,
} from './types/comm-message.types.js';
export {
  STATUS_TRANSITIONS,
  encodeCursor,
  decodeCursor,
} from './types/comm-message.types.js';

// Sprint 9 schemas
export {
  PhoneE164,
  Email,
  PhoneOrEmail,
  TenantId,
  ContactId,
  TemplateId,
  MessageId,
  TemplateVariables,
  SendMessageSchema,
  MessageFiltersSchema,
  BatchSendSchema,
  BatchSendItemSchema,
  UpdateStatusSchema,
  CreateMessageRowSchema,
} from './schemas/message.schema.js';
export type {
  SendMessageInput,
  MessageFiltersInput,
  BatchSendInput,
  BatchSendItem,
  UpdateStatusInput,
  CreateMessageRow,
} from './schemas/message.schema.js';

export {
  WebhookEventSchema,
  MetaWebhookSchema,
  MailgunWebhookSchema,
} from './schemas/webhook.schema.js';
export type {
  WebhookEventInput,
  MetaWebhookPayload,
  MailgunWebhookPayload,
} from './schemas/webhook.schema.js';

// Sprint 9 helpers
export {
  extractPhoneE164,
  normalizePhone,
  isMaroccanPhone,
  formatPhoneForMeta,
  validateEmail,
  normalizeEmail,
} from './helpers/phone-email.helper.js';

// Sprint 9 errors
export {
  CommBaseError,
  InvalidStatusTransitionError,
  MessageNotFoundError,
  ContactNotFoundError,
  TenantMismatchError,
  NoAvailableChannelError,
} from './errors/messages.errors.js';

// Sprint 9 services
export {
  MessagesRepositoryService,
  COMM_MESSAGES_REPO,
} from './services/messages-repository.service.js';
export type { UpdateStatusOptions } from './services/messages-repository.service.js';
