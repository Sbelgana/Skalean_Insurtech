export class KafkaPublisherBaseError extends Error {
  public readonly rootCause?: unknown;
  public readonly meta?: Record<string, unknown>;

  constructor(
    message: string,
    rootCause?: unknown,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (rootCause !== undefined) this.rootCause = rootCause;
    if (meta !== undefined) this.meta = meta;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class InvalidEventError extends KafkaPublisherBaseError {
  constructor(
    public readonly topic: string,
    public readonly zodIssues: unknown,
    meta?: Record<string, unknown>,
  ) {
    super(`Invalid event payload for topic ${topic}`, undefined, meta);
  }
}

export class KafkaPublishError extends KafkaPublisherBaseError {
  constructor(
    public readonly topic: string,
    cause: unknown,
    public readonly retryCount: number,
    meta?: Record<string, unknown>,
  ) {
    super(`Failed to publish event to topic ${topic} after ${retryCount} retries`, cause, meta);
  }
}

export class CircuitBreakerOpenError extends KafkaPublisherBaseError {
  constructor(public readonly topic: string, public readonly resetInMs: number) {
    super(`Circuit breaker open for topic ${topic}, retry in ${resetInMs}ms`);
  }
}

export class MessageTooLargeError extends KafkaPublisherBaseError {
  constructor(
    public readonly topic: string,
    public readonly sizeBytes: number,
    public readonly maxBytes: number,
  ) {
    super(
      `Message size ${sizeBytes}B exceeds limit ${maxBytes}B for topic ${topic}; consider claim-check pattern`,
    );
  }
}

export class MissingTenantContextError extends KafkaPublisherBaseError {
  constructor() {
    super('TenantContext is empty; wrap publish call in kafkaTenantContext.run()');
  }
}

export class MissingCorrelationIdError extends KafkaPublisherBaseError {
  constructor() {
    super('RequestContext correlation_id missing; wrap publish call in kafkaRequestContext.run()');
  }
}

export class TopicSchemaNotFoundError extends KafkaPublisherBaseError {
  constructor(public readonly topic: string) {
    super(`No Zod schema registered for topic ${topic} in topicSchemaMap`);
  }
}

export class OutboxUnavailableError extends KafkaPublisherBaseError {
  constructor(public readonly tableName: string, cause: unknown) {
    super(`Outbox table ${tableName} is unavailable; Sprint 35 not yet activated`, cause);
  }
}
