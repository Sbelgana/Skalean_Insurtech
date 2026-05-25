/**
 * @insurtech/comm/errors/messages.errors
 *
 * Erreurs metier specifiques aux messages.
 * Code uppercase snake_case pour mapping HTTP / i18n cote API.
 */

export class CommBaseError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export class InvalidStatusTransitionError extends CommBaseError {
  constructor(from: string, to: string) {
    super(
      'INVALID_STATUS_TRANSITION',
      `Cannot transition message status from ${from} to ${to}`,
      { from, to },
    );
  }
}

export class MessageNotFoundError extends CommBaseError {
  constructor(messageId: string) {
    super('MESSAGE_NOT_FOUND', `Comm message ${messageId} not found`, { messageId });
  }
}

export class ContactNotFoundError extends CommBaseError {
  constructor(contactId: string) {
    super('CONTACT_NOT_FOUND', `Contact ${contactId} not found`, { contactId });
  }
}

export class TenantMismatchError extends CommBaseError {
  constructor(expected: string, got: string) {
    super('TENANT_MISMATCH', 'Cross-tenant access denied on comm_messages', { expected, got });
  }
}

export class NoAvailableChannelError extends CommBaseError {
  constructor(contactId: string, reasons: ReadonlyArray<string>) {
    super(
      'NO_AVAILABLE_CHANNEL',
      `No reachable channel for contact ${contactId}: ${reasons.join(', ')}`,
      { contactId, reasons: [...reasons] },
    );
  }
}
