/**
 * @insurtech/comm
 *
 * Sprint 5 Tache 2.1.13 :
 *   - NodemailerEmailService (SMTP transport)
 *   - Handlebars templates (verify / recovery / password-changed)
 *   - 4 locales : fr-MA, fr-FR, ar-MA, en
 *
 * Sprint 9 will add WhatsApp + SMS channels via the same EmailService surface.
 */

export const VERSION = '0.1.0';

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
