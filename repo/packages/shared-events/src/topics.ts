/**
 * Source unique de verite des topics Kafka Skalean InsurTech.
 * Format strict : insurtech.events.<vertical>.<entity>.<action>
 * Aucune emoji autorisee dans les noms (decision-006).
 */
export enum Topics {
  // Auth (7)
  AUTH_USER_CREATED = 'insurtech.events.auth.user.created',
  AUTH_USER_SIGNED_IN = 'insurtech.events.auth.user.signed_in',
  AUTH_USER_SIGNED_OUT = 'insurtech.events.auth.user.signed_out',
  AUTH_USER_LOCKED = 'insurtech.events.auth.user.locked',
  AUTH_USER_UNLOCKED = 'insurtech.events.auth.user.unlocked',
  AUTH_USER_PASSWORD_RESET_REQUESTED = 'insurtech.events.auth.user.password_reset_requested',
  AUTH_USER_MFA_ENABLED = 'insurtech.events.auth.user.mfa_enabled',
  // CRM (6)
  CRM_CONTACT_CREATED = 'insurtech.events.crm.contact.created',
  CRM_CONTACT_UPDATED = 'insurtech.events.crm.contact.updated',
  CRM_DEAL_CREATED = 'insurtech.events.crm.deal.created',
  CRM_DEAL_STAGE_CHANGED = 'insurtech.events.crm.deal.stage_changed',
  CRM_INTERACTION_RECORDED = 'insurtech.events.crm.interaction.recorded',
  CRM_INTERACTION_EMAIL_RECEIVED = 'insurtech.events.crm.interaction.email_received',
  // Booking (3)
  BOOKING_CREATED = 'insurtech.events.booking.created',
  BOOKING_CONFIRMED = 'insurtech.events.booking.confirmed',
  BOOKING_CANCELLED = 'insurtech.events.booking.cancelled',
  // Comm (8)
  COMM_MESSAGE_SENT = 'insurtech.events.comm.message.sent',
  COMM_MESSAGE_DELIVERED = 'insurtech.events.comm.message.delivered',
  COMM_MESSAGE_FAILED = 'insurtech.events.comm.message.failed',
  COMM_MESSAGE_BOUNCED = 'insurtech.events.comm.message.bounced',
  COMM_WHATSAPP_INBOUND = 'insurtech.events.comm.whatsapp.inbound',
  COMM_SMS_INBOUND = 'insurtech.events.comm.sms.inbound',
  COMM_EMAIL_INBOUND = 'insurtech.events.comm.email.inbound',
  COMM_NOTIFICATION_PUSHED = 'insurtech.events.comm.notification.pushed',
  // Pay (6)
  PAY_TRANSACTION_INITIATED = 'insurtech.events.pay.transaction.initiated',
  PAY_TRANSACTION_COMPLETED = 'insurtech.events.pay.transaction.completed',
  PAY_TRANSACTION_FAILED = 'insurtech.events.pay.transaction.failed',
  PAY_TRANSACTION_REFUNDED = 'insurtech.events.pay.transaction.refunded',
  PAY_INVOICE_ISSUED = 'insurtech.events.pay.invoice.issued',
  PAY_INVOICE_PAID = 'insurtech.events.pay.invoice.paid',
  // Insure (4)
  INSURE_QUOTE_REQUESTED = 'insurtech.events.insure.quote.requested',
  INSURE_QUOTE_ISSUED = 'insurtech.events.insure.quote.issued',
  INSURE_POLICY_SIGNED = 'insurtech.events.insure.policy.signed',
  INSURE_POLICY_RENEWED = 'insurtech.events.insure.policy.renewed',
  // Repair (3)
  REPAIR_SINISTRE_DECLARED = 'insurtech.events.repair.sinistre.declared',
  REPAIR_SINISTRE_ASSIGNED = 'insurtech.events.repair.sinistre.assigned',
  REPAIR_SINISTRE_CLOSED = 'insurtech.events.repair.sinistre.closed',
  // Audit (3)
  AUDIT_RECORDED = 'insurtech.events.audit.recorded',
  AUDIT_ACCESS_DENIED = 'insurtech.events.audit.access_denied',
  AUDIT_DATA_EXPORTED = 'insurtech.events.audit.data_exported',
  // Books (2)
  BOOKS_LEDGER_ENTRY_POSTED = 'insurtech.events.books.ledger.entry_posted',
  BOOKS_PERIOD_CLOSED = 'insurtech.events.books.period.closed',
  // Stock (2)
  STOCK_ADJUSTED = 'insurtech.events.stock.adjusted',
  STOCK_MOVEMENT_RECORDED = 'insurtech.events.stock.movement.recorded',
  // HR (2)
  HR_EMPLOYEE_ONBOARDED = 'insurtech.events.hr.employee.onboarded',
  HR_EMPLOYEE_OFFBOARDED = 'insurtech.events.hr.employee.offboarded',
  // System (3)
  SYSTEM_ERROR_RAISED = 'insurtech.events.system.error.raised',
  SYSTEM_HEALTH_CHANGED = 'insurtech.events.system.health.changed',
  SYSTEM_CONFIG_UPDATED = 'insurtech.events.system.config.updated',
}

export type TopicVertical =
  | 'auth'
  | 'crm'
  | 'booking'
  | 'comm'
  | 'pay'
  | 'insure'
  | 'repair'
  | 'audit'
  | 'books'
  | 'stock'
  | 'hr'
  | 'system';

export function getTopicVertical(topic: Topics): TopicVertical {
  const parts = topic.split('.');
  const part = parts[2];
  if (parts.length < 3 || part === undefined) {
    throw new Error(`Invalid topic format: ${topic}`);
  }
  return part as TopicVertical;
}

export function getTopicEntity(topic: Topics): string {
  const parts = topic.split('.');
  const part = parts[3];
  if (parts.length < 4 || part === undefined) {
    throw new Error(`Invalid topic format: ${topic}`);
  }
  return part;
}

export function getTopicAction(topic: Topics): string {
  const parts = topic.split('.');
  if (parts.length < 5) {
    throw new Error(`Invalid topic format: ${topic}`);
  }
  return parts.slice(4).join('.');
}

export function getTopicsByVertical(vertical: TopicVertical): Topics[] {
  return Object.values(Topics).filter((t) => getTopicVertical(t) === vertical);
}

export function isKnownTopic(value: string): value is Topics {
  return (Object.values(Topics) as string[]).includes(value);
}
