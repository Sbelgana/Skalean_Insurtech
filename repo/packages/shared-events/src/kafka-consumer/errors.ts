/**
 * Error types for KafkaConsumerBase.
 * ConsumerValidationError: permanent, no retry, routes to DLQ.
 * ConsumerTransientError: transient, retry eligible.
 * DlqFailureError: critical, DLQ publish itself failed.
 */

export class ConsumerValidationError extends Error {
  public readonly context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ConsumerValidationError';
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ConsumerTransientError extends Error {
  public readonly rootCause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ConsumerTransientError';
    if (cause !== undefined) this.rootCause = cause;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class DlqFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DlqFailureError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}
