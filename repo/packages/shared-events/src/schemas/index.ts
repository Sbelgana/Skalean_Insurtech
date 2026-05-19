import { z } from 'zod';
import { Topics } from '../topics.js';

import { UserCreatedPayloadSchema } from './auth/user-created.schema.js';
import { UserSignedInPayloadSchema } from './auth/user-signed-in.schema.js';
import { UserSignedOutPayloadSchema } from './auth/user-signed-out.schema.js';
import { UserLockedPayloadSchema } from './auth/user-locked.schema.js';
import { UserUnlockedPayloadSchema } from './auth/user-unlocked.schema.js';
import { UserPasswordResetRequestedPayloadSchema } from './auth/user-password-reset-requested.schema.js';
import { UserMfaEnabledPayloadSchema } from './auth/user-mfa-enabled.schema.js';
import { ContactCreatedPayloadSchema } from './crm/contact-created.schema.js';
import { ContactUpdatedPayloadSchema } from './crm/contact-updated.schema.js';
import { DealCreatedPayloadSchema } from './crm/deal-created.schema.js';
import { DealStageChangedPayloadSchema } from './crm/deal-stage-changed.schema.js';
import { InteractionRecordedPayloadSchema } from './crm/interaction-recorded.schema.js';
import { InteractionEmailReceivedPayloadSchema } from './crm/interaction-email-received.schema.js';
import { BookingCreatedPayloadSchema } from './booking/booking-created.schema.js';
import { BookingConfirmedPayloadSchema } from './booking/booking-confirmed.schema.js';
import { BookingCancelledPayloadSchema } from './booking/booking-cancelled.schema.js';
import { MessageSentPayloadSchema } from './comm/message-sent.schema.js';
import { MessageDeliveredPayloadSchema } from './comm/message-delivered.schema.js';
import { MessageFailedPayloadSchema } from './comm/message-failed.schema.js';
import { MessageBouncedPayloadSchema } from './comm/message-bounced.schema.js';
import { WhatsappInboundPayloadSchema } from './comm/whatsapp-inbound.schema.js';
import { SmsInboundPayloadSchema } from './comm/sms-inbound.schema.js';
import { EmailInboundPayloadSchema } from './comm/email-inbound.schema.js';
import { NotificationPushedPayloadSchema } from './comm/notification-pushed.schema.js';
import { TransactionInitiatedPayloadSchema } from './pay/transaction-initiated.schema.js';
import { TransactionCompletedPayloadSchema } from './pay/transaction-completed.schema.js';
import { TransactionFailedPayloadSchema } from './pay/transaction-failed.schema.js';
import { TransactionRefundedPayloadSchema } from './pay/transaction-refunded.schema.js';
import { InvoiceIssuedPayloadSchema } from './pay/invoice-issued.schema.js';
import { InvoicePaidPayloadSchema } from './pay/invoice-paid.schema.js';
import { QuoteRequestedPayloadSchema } from './insure/quote-requested.schema.js';
import { QuoteIssuedPayloadSchema } from './insure/quote-issued.schema.js';
import { PolicySignedPayloadSchema } from './insure/policy-signed.schema.js';
import { PolicyRenewedPayloadSchema } from './insure/policy-renewed.schema.js';
import { SinistreDeclaredPayloadSchema } from './repair/sinistre-declared.schema.js';
import { SinistreAssignedPayloadSchema } from './repair/sinistre-assigned.schema.js';
import { SinistreClosedPayloadSchema } from './repair/sinistre-closed.schema.js';
import { AuditRecordedPayloadSchema } from './audit/audit-recorded.schema.js';
import { AuditAccessDeniedPayloadSchema } from './audit/audit-access-denied.schema.js';
import { AuditDataExportedPayloadSchema } from './audit/audit-data-exported.schema.js';
import { LedgerEntryPostedPayloadSchema } from './books/ledger-entry-posted.schema.js';
import { PeriodClosedPayloadSchema } from './books/period-closed.schema.js';
import { StockAdjustedPayloadSchema } from './stock/stock-adjusted.schema.js';
import { StockMovementRecordedPayloadSchema } from './stock/stock-movement-recorded.schema.js';
import { EmployeeOnboardedPayloadSchema } from './hr/employee-onboarded.schema.js';
import { EmployeeOffboardedPayloadSchema } from './hr/employee-offboarded.schema.js';
import { SystemErrorRaisedPayloadSchema } from './system/system-error-raised.schema.js';
import { SystemHealthChangedPayloadSchema } from './system/system-health-changed.schema.js';
import { SystemConfigUpdatedPayloadSchema } from './system/system-config-updated.schema.js';

export * from './auth/index.js';
export * from './crm/index.js';
export * from './booking/index.js';
export * from './comm/index.js';
export * from './pay/index.js';
export * from './insure/index.js';
export * from './repair/index.js';
export * from './audit/index.js';
export * from './books/index.js';
export * from './stock/index.js';
export * from './hr/index.js';
export * from './system/index.js';

export const topicSchemaMap: Record<Topics, z.ZodTypeAny> = {
  [Topics.AUTH_USER_CREATED]: UserCreatedPayloadSchema,
  [Topics.AUTH_USER_SIGNED_IN]: UserSignedInPayloadSchema,
  [Topics.AUTH_USER_SIGNED_OUT]: UserSignedOutPayloadSchema,
  [Topics.AUTH_USER_LOCKED]: UserLockedPayloadSchema,
  [Topics.AUTH_USER_UNLOCKED]: UserUnlockedPayloadSchema,
  [Topics.AUTH_USER_PASSWORD_RESET_REQUESTED]: UserPasswordResetRequestedPayloadSchema,
  [Topics.AUTH_USER_MFA_ENABLED]: UserMfaEnabledPayloadSchema,
  [Topics.CRM_CONTACT_CREATED]: ContactCreatedPayloadSchema,
  [Topics.CRM_CONTACT_UPDATED]: ContactUpdatedPayloadSchema,
  [Topics.CRM_DEAL_CREATED]: DealCreatedPayloadSchema,
  [Topics.CRM_DEAL_STAGE_CHANGED]: DealStageChangedPayloadSchema,
  [Topics.CRM_INTERACTION_RECORDED]: InteractionRecordedPayloadSchema,
  [Topics.CRM_INTERACTION_EMAIL_RECEIVED]: InteractionEmailReceivedPayloadSchema,
  [Topics.BOOKING_CREATED]: BookingCreatedPayloadSchema,
  [Topics.BOOKING_CONFIRMED]: BookingConfirmedPayloadSchema,
  [Topics.BOOKING_CANCELLED]: BookingCancelledPayloadSchema,
  [Topics.COMM_MESSAGE_SENT]: MessageSentPayloadSchema,
  [Topics.COMM_MESSAGE_DELIVERED]: MessageDeliveredPayloadSchema,
  [Topics.COMM_MESSAGE_FAILED]: MessageFailedPayloadSchema,
  [Topics.COMM_MESSAGE_BOUNCED]: MessageBouncedPayloadSchema,
  [Topics.COMM_WHATSAPP_INBOUND]: WhatsappInboundPayloadSchema,
  [Topics.COMM_SMS_INBOUND]: SmsInboundPayloadSchema,
  [Topics.COMM_EMAIL_INBOUND]: EmailInboundPayloadSchema,
  [Topics.COMM_NOTIFICATION_PUSHED]: NotificationPushedPayloadSchema,
  [Topics.PAY_TRANSACTION_INITIATED]: TransactionInitiatedPayloadSchema,
  [Topics.PAY_TRANSACTION_COMPLETED]: TransactionCompletedPayloadSchema,
  [Topics.PAY_TRANSACTION_FAILED]: TransactionFailedPayloadSchema,
  [Topics.PAY_TRANSACTION_REFUNDED]: TransactionRefundedPayloadSchema,
  [Topics.PAY_INVOICE_ISSUED]: InvoiceIssuedPayloadSchema,
  [Topics.PAY_INVOICE_PAID]: InvoicePaidPayloadSchema,
  [Topics.INSURE_QUOTE_REQUESTED]: QuoteRequestedPayloadSchema,
  [Topics.INSURE_QUOTE_ISSUED]: QuoteIssuedPayloadSchema,
  [Topics.INSURE_POLICY_SIGNED]: PolicySignedPayloadSchema,
  [Topics.INSURE_POLICY_RENEWED]: PolicyRenewedPayloadSchema,
  [Topics.REPAIR_SINISTRE_DECLARED]: SinistreDeclaredPayloadSchema,
  [Topics.REPAIR_SINISTRE_ASSIGNED]: SinistreAssignedPayloadSchema,
  [Topics.REPAIR_SINISTRE_CLOSED]: SinistreClosedPayloadSchema,
  [Topics.AUDIT_RECORDED]: AuditRecordedPayloadSchema,
  [Topics.AUDIT_ACCESS_DENIED]: AuditAccessDeniedPayloadSchema,
  [Topics.AUDIT_DATA_EXPORTED]: AuditDataExportedPayloadSchema,
  [Topics.BOOKS_LEDGER_ENTRY_POSTED]: LedgerEntryPostedPayloadSchema,
  [Topics.BOOKS_PERIOD_CLOSED]: PeriodClosedPayloadSchema,
  [Topics.STOCK_ADJUSTED]: StockAdjustedPayloadSchema,
  [Topics.STOCK_MOVEMENT_RECORDED]: StockMovementRecordedPayloadSchema,
  [Topics.HR_EMPLOYEE_ONBOARDED]: EmployeeOnboardedPayloadSchema,
  [Topics.HR_EMPLOYEE_OFFBOARDED]: EmployeeOffboardedPayloadSchema,
  [Topics.SYSTEM_ERROR_RAISED]: SystemErrorRaisedPayloadSchema,
  [Topics.SYSTEM_HEALTH_CHANGED]: SystemHealthChangedPayloadSchema,
  [Topics.SYSTEM_CONFIG_UPDATED]: SystemConfigUpdatedPayloadSchema,
};

export const topicEventNameMap: Map<string, Topics> = new Map(
  (Object.values(Topics) as Topics[]).map((t) => [t as string, t]),
);
