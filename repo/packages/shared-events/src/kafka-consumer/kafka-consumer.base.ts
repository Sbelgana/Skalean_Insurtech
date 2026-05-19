/**
 * Abstract base class for all Kafka consumers.
 * Provides: manual ack, exponential-backoff retry, DLQ routing,
 * idempotency via (event_id, group_id), OTel spans + metrics,
 * and tenant_id propagation via AsyncLocalStorage.
 *
 * Decision-004: allowAutoTopicCreation is always false.
 * Decision-006: no emoji in logs.
 */
import { Injectable } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import { trace, SpanKind, SpanStatusCode, metrics } from '@opentelemetry/api';
import type { Counter, Histogram } from '@opentelemetry/api';
import type { Logger as PinoLogger } from 'pino';
import type { z } from 'zod';
import { topicSchemaMap } from '../schemas/index.js';
import type { Topics } from '../topics.js';
import type { EventEnvelope } from '../types/event-envelope.js';
import { kafkaTenantContext, kafkaRequestContext } from '../kafka-publisher/kafka-context.js';
import type { ConsumerOptions, DlqMetadata, ResolvedConsumerOptions } from './kafka-consumer.types.js';
import type { IIdempotencyRepository } from './idempotency-repository.js';
import type { DlqPublisherService } from './dlq-publisher.service.js';
import { ConsumerValidationError, DlqFailureError } from './errors.js';

const GROUP_ID_REGEX = /^[a-z][a-z0-9-]{4,40}-handler$/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export abstract class KafkaConsumerBase<TPayload> implements OnModuleInit, OnModuleDestroy {
  protected readonly logger: PinoLogger;
  private consumer: Consumer | null = null;
  private isShuttingDown = false;
  private readonly opts: ResolvedConsumerOptions;

  private readonly messagesCounter: Counter;
  private readonly failuresCounter: Counter;
  private readonly dlqCounter: Counter;
  private readonly handleHistogram: Histogram;

  /**
   * Concrete subclasses must inject these from NestJS DI and forward to super():
   *   kafka     : @Inject(KAFKA_CONSUMER_CLIENT)
   *   options   : @Inject(KAFKA_CONSUMER_OPTIONS)
   *   dlq       : DlqPublisherService (from module providers)
   *   idempRepo : @Inject(IDEMPOTENCY_REPOSITORY)
   *   logger    : @Inject('PINO_LOGGER') (optional, defaults to pino())
   */
  constructor(
    private readonly kafka: Kafka,
    options: ConsumerOptions,
    private readonly dlqPublisher: DlqPublisherService,
    private readonly idempotencyRepo: IIdempotencyRepository,
    logger?: PinoLogger,
  ) {
    this.opts = {
      retry: {
        maxAttempts: options.retry?.maxAttempts ?? 3,
        initialMs: options.retry?.initialMs ?? 1000,
        multiplier: options.retry?.multiplier ?? 5,
        maxMs: options.retry?.maxMs ?? 30_000,
      },
      dlq: {
        enabled: options.dlq?.enabled ?? true,
        topicPrefix: options.dlq?.topicPrefix ?? 'insurtech.events.dlq',
      },
      session: {
        timeoutMs: options.session?.timeoutMs ?? 30_000,
        heartbeatMs: options.session?.heartbeatMs ?? 3_000,
      },
      observability: {
        serviceName: options.observability?.serviceName ?? 'kafka-consumer',
        metricsPrefix: options.observability?.metricsPrefix ?? 'kafka_consumer',
      },
      validationStrict: options.validationStrict ?? true,
    };

    // Logger: use provided instance or create a minimal fallback.
    // In production, concrete consumers inject 'PINO_LOGGER' and pass it here.
    const baseLogger = logger;
    if (baseLogger !== undefined) {
      this.logger = baseLogger.child({ component: this.constructor.name });
    } else {
      // Lazy import pino only when no logger provided (test / standalone use).
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pinoLib = (require as (id: string) => { default: () => PinoLogger })('pino');
      this.logger = pinoLib.default().child({ component: this.constructor.name });
    }

    const meter = metrics.getMeter(this.opts.observability.serviceName, '1.0.0');
    const prefix = this.opts.observability.metricsPrefix;
    this.messagesCounter = meter.createCounter(`${prefix}_messages_total`, {
      description: 'Total Kafka messages processed by consumer',
    });
    this.failuresCounter = meter.createCounter(`${prefix}_failures_total`, {
      description: 'Total Kafka consumer message processing failures',
    });
    this.dlqCounter = meter.createCounter(`${prefix}_dlq_total`, {
      description: 'Total messages routed to DLQ by consumer',
    });
    this.handleHistogram = meter.createHistogram(`${prefix}_handle_duration_ms`, {
      description: 'Duration of handle() invocations in milliseconds',
      unit: 'ms',
    });
  }

  /** Subclass must return the topic this consumer subscribes to. */
  abstract getTopic(): Topics;

  /** Subclass must return the consumer group id. Must match /^[a-z][a-z0-9-]{4,40}-handler$/. */
  abstract getGroupId(): string;

  /**
   * Business logic for each validated, deduplicated message.
   * Runs inside kafkaTenantContext.run() so tenant_id is available via ALS.
   */
  abstract handle(payload: TPayload, envelope: EventEnvelope<TPayload>): Promise<void>;

  /**
   * Extracts the module prefix for the DLQ topic.
   * 'whatsapp-notifications-handler' -> 'whatsapp'
   */
  protected getDlqModule(): string {
    const withoutHandler = this.getGroupId().replace(/-handler$/, '');
    return withoutHandler.split('-')[0] ?? 'unknown';
  }

  async onModuleInit(): Promise<void> {
    const groupId = this.getGroupId();
    if (!GROUP_ID_REGEX.test(groupId)) {
      throw new Error(
        `Invalid group_id "${groupId}" for ${this.constructor.name}. ` +
          `Must match ${GROUP_ID_REGEX.source} (e.g. "whatsapp-notifications-handler")`,
      );
    }

    const topic = this.getTopic();
    const schema = topicSchemaMap[topic];
    if (schema === undefined) {
      throw new Error(
        `No Zod schema registered for topic "${String(topic)}". Register in schemas/index.ts`,
      );
    }

    this.consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: this.opts.session.timeoutMs,
      heartbeatInterval: this.opts.session.heartbeatMs,
      allowAutoTopicCreation: false,
      readUncommitted: false,
    });

    await this.consumer.connect();
    await this.consumer.subscribe({ topic: String(topic), fromBeginning: false });

    this.logger.info(
      {
        topic: String(topic),
        group_id: groupId,
        consumer_class: this.constructor.name,
        retry_max_attempts: this.opts.retry.maxAttempts,
        dlq_enabled: this.opts.dlq.enabled,
      },
      'Kafka consumer connected and subscribed',
    );

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async (msg: EachMessagePayload): Promise<void> => {
        await this.onMessage(msg);
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.consumer !== null) {
      this.logger.info(
        { group_id: this.getGroupId() },
        'Kafka consumer disconnecting gracefully',
      );
      try {
        await this.consumer.disconnect();
      } catch (err) {
        this.logger.error({ err }, 'Error during Kafka consumer disconnect');
      }
      this.consumer = null;
    }
  }

  private async onMessage(eachMsg: EachMessagePayload): Promise<void> {
    const { topic, partition, message, heartbeat } = eachMsg;
    const startTime = Date.now();
    const groupId = this.getGroupId();
    const tracer = trace.getTracer(this.opts.observability.serviceName);

    const span = tracer.startSpan(`kafka.consume.${topic}`, {
      kind: SpanKind.CONSUMER,
      attributes: {
        'messaging.system': 'kafka',
        'messaging.destination': topic,
        'messaging.kafka.partition': partition,
        'messaging.kafka.consumer_group': groupId,
        'messaging.kafka.offset': message.offset,
      },
    });

    let envelope: EventEnvelope<TPayload> | null = null;
    const attemptRef = { value: 0 };

    try {
      // Step 1: decode raw bytes
      const rawValue = message.value?.toString('utf-8');
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        throw new ConsumerValidationError('Message value is empty or null', {
          topic,
          partition,
          offset: message.offset,
        });
      }

      const sizeBytes = Buffer.byteLength(rawValue, 'utf-8');
      if (sizeBytes > 100 * 1024) {
        this.logger.warn(
          { size_bytes: sizeBytes, topic, partition, offset: message.offset },
          'Large payload detected',
        );
      }

      // Step 2: parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawValue);
      } catch {
        throw new ConsumerValidationError('Malformed JSON in message value', {
          topic,
          partition,
          offset: message.offset,
          raw_preview: rawValue.slice(0, 200),
        });
      }
      envelope = parsed as EventEnvelope<TPayload>;
      const eventId = (envelope as { event_id?: string }).event_id ?? 'UNKNOWN';
      span.setAttribute('messaging.message_id', eventId);

      // Step 3: validate payload with registered Zod schema
      const schema = topicSchemaMap[this.getTopic()] as z.ZodTypeAny;
      const validation = schema.safeParse((envelope as EventEnvelope<unknown>).payload);
      if (!validation.success) {
        throw new ConsumerValidationError('Zod payload validation failed', {
          topic,
          partition,
          offset: message.offset,
          event_id: eventId,
          issues: validation.error.issues,
        });
      }
      const parsedPayload = validation.data as TPayload;

      // Step 4: idempotency check — skip if already processed
      const inserted = await this.idempotencyRepo.tryInsert(eventId, groupId);
      if (!inserted) {
        this.logger.info(
          { event_id: eventId, topic, partition, offset: message.offset, group_id: groupId },
          'Idempotent skip: message already processed',
        );
        await this.commitOffset(eachMsg);
        span.setStatus({ code: SpanStatusCode.OK });
        return;
      }

      // Step 5: invoke handle() with retry + tenant context propagation
      await this.executeHandleWithRetry(parsedPayload, envelope, attemptRef);

      // Step 6: manual ack — commit offset only after successful handle
      await this.commitOffset(eachMsg);

      const durationMs = Date.now() - startTime;
      this.handleHistogram.record(durationMs, { topic, group_id: groupId, status: 'success' });
      this.messagesCounter.add(1, { topic, group_id: groupId, status: 'success' });
      span.setAttribute('messaging.kafka.partition', partition);
      span.setStatus({ code: SpanStatusCode.OK });

      this.logger.info(
        {
          event_id: eventId,
          topic,
          partition,
          offset: message.offset,
          duration_ms: durationMs,
          attempt_count: attemptRef.value,
          group_id: groupId,
          tenant_id: (envelope as EventEnvelope<unknown>).tenant_id,
        },
        'Kafka message processed successfully',
      );
    } catch (err) {
      const durationMs = Date.now() - startTime;
      this.handleHistogram.record(durationMs, { topic, group_id: groupId, status: 'failure' });
      this.failuresCounter.add(1, {
        topic,
        group_id: groupId,
        error_class: err instanceof Error ? err.constructor.name : 'Unknown',
      });

      this.logger.error(
        {
          err,
          event_id: envelope !== null ? (envelope as EventEnvelope<unknown>).event_id : 'UNKNOWN',
          topic,
          partition,
          offset: message.offset,
          attempt_count: attemptRef.value,
          group_id: groupId,
        },
        'Kafka message processing failed permanently',
      );

      await this.handleFailure(err, envelope, message, eachMsg, attemptRef.value);

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      span.end();
      await heartbeat();
    }
  }

  private async executeHandleWithRetry(
    parsedPayload: TPayload,
    envelope: EventEnvelope<TPayload>,
    attemptRef: { value: number },
  ): Promise<void> {
    let lastError: unknown = undefined;
    const { maxAttempts, initialMs, multiplier, maxMs } = this.opts.retry;

    for (let i = 0; i < maxAttempts; i++) {
      attemptRef.value = i + 1;
      try {
        // Inject tenant_id and correlation_id into AsyncLocalStorage before calling handle()
        const tenantId = (envelope as EventEnvelope<unknown>).tenant_id ?? '';
        const correlationId = (envelope as EventEnvelope<unknown>).correlation_id;

        await kafkaTenantContext.run({ tenantId }, async () => {
          if (correlationId !== null && correlationId !== undefined) {
            return kafkaRequestContext.run({ correlationId }, async () =>
              this.handle(parsedPayload, envelope),
            );
          }
          return this.handle(parsedPayload, envelope);
        });
        return; // success
      } catch (err) {
        lastError = err;

        // Validation errors are permanent — no retry
        if (err instanceof ConsumerValidationError) {
          throw err;
        }

        const isLastAttempt = i === maxAttempts - 1;
        if (isLastAttempt) break;

        const delayMs = Math.min(initialMs * Math.pow(multiplier, i), maxMs);
        this.logger.warn(
          {
            event_id: (envelope as EventEnvelope<unknown>).event_id,
            topic: String(this.getTopic()),
            attempt: i + 1,
            next_delay_ms: delayMs,
            error_class: err instanceof Error ? err.constructor.name : 'Unknown',
            error_message: err instanceof Error ? err.message : String(err),
            group_id: this.getGroupId(),
          },
          'Handle failed, retrying',
        );
        await sleep(delayMs);
      }
    }

    throw lastError;
  }

  private async handleFailure(
    err: unknown,
    envelope: EventEnvelope<TPayload> | null,
    message: { offset: string },
    eachMsg: EachMessagePayload,
    attemptCount: number,
  ): Promise<void> {
    const error = err instanceof Error ? err : new Error(String(err));
    const groupId = this.getGroupId();
    const topic = this.getTopic();

    if (this.opts.dlq.enabled) {
      // For pre-parse failures (envelope === null), use a minimal stub envelope so DLQ
      // still receives a routable message with error metadata.
      const effectiveEnvelope: EventEnvelope<unknown> =
        envelope !== null
          ? (envelope as EventEnvelope<unknown>)
          : {
              event_id: 'PARSE_FAILURE',
              event_name: 'PARSE_FAILURE',
              event_version: '0.0',
              occurred_at: new Date().toISOString(),
              tenant_id: null,
              user_id: null,
              correlation_id: null,
              payload: null,
            };

      const dlqTopic = `${this.opts.dlq.topicPrefix}.${this.getDlqModule()}`;
      const meta: DlqMetadata = {
        original_envelope: effectiveEnvelope,
        error_class: error.constructor.name,
        error_message: error.message,
        stacktrace: error.stack ?? '',
        attempt_count: attemptCount,
        consumer_group_id: groupId,
        source_topic: String(topic),
        source_partition: eachMsg.partition,
        source_offset: message.offset,
        failed_at: new Date().toISOString(),
        error_type: err instanceof ConsumerValidationError ? 'validation_error' : 'transient_error',
      };

      // Publish to DLQ — failure here is critical (message may be stuck).
      try {
        await this.dlqPublisher.publish(dlqTopic, meta);
        this.dlqCounter.add(1, {
          dlq_topic: dlqTopic,
          error_class: error.constructor.name,
        });
      } catch (dlqErr) {
        this.logger.error(
          {
            dlq_err: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
            event_id: effectiveEnvelope.event_id,
          },
          'CRITICAL: DLQ publish failed, message may be stuck',
        );
        throw new DlqFailureError(
          `DLQ publish failed for event ${effectiveEnvelope.event_id}: ${
            dlqErr instanceof Error ? dlqErr.message : String(dlqErr)
          }`,
        );
      }

      // Commit offset outside the DLQ error scope — non-fatal (will replay on restart).
      await this.commitOffset(eachMsg);
    }
  }

  private async commitOffset(eachMsg: EachMessagePayload): Promise<void> {
    const c = this.consumer;
    if (c === null || this.isShuttingDown) return;
    try {
      // Use Number arithmetic; Kafka offsets fit comfortably within Number.MAX_SAFE_INTEGER.
      const currentOffset = Number(eachMsg.message.offset);
      const nextOffset = (Number.isFinite(currentOffset) ? currentOffset + 1 : 1).toString();
      await c.commitOffsets([
        {
          topic: eachMsg.topic,
          partition: eachMsg.partition,
          offset: nextOffset,
        },
      ]);
    } catch (err) {
      this.logger.error(
        {
          err,
          topic: eachMsg.topic,
          partition: eachMsg.partition,
          offset: eachMsg.message.offset,
        },
        'commitOffsets failed (non-fatal, message will replay on restart)',
      );
    }
  }
}
