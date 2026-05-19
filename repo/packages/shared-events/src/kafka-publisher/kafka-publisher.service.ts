import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { Producer, RecordMetadata } from 'kafkajs';
import { CompressionTypes } from 'kafkajs';
import { trace, SpanStatusCode, context as otelContext, propagation } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';
import type { Counter, Histogram, ObservableGauge } from '@opentelemetry/api';
import type { Logger as PinoLogger } from 'pino';
import type { KafkaCircuitBreaker } from './circuit-breaker.config.js';
import { topicSchemaMap } from '../schemas/index.js';
import type { Topics } from '../topics.js';
import { buildEnvelope } from '../helpers/build-envelope.js';
import { kafkaTenantContext, kafkaRequestContext } from './kafka-context.js';
import {
  KAFKA_PUBLISHER_OPTIONS,
  KAFKA_PRODUCER,
} from './kafka-publisher.config.js';
import type { KafkaPublisherOptions, PublishOptions } from './kafka-publisher.config.js';
import {
  InvalidEventError,
  KafkaPublishError,
  CircuitBreakerOpenError,
  MessageTooLargeError,
  MissingTenantContextError,
  TopicSchemaNotFoundError,
} from './errors.js';
import { isRetriableKafkaError, computeBackoffMs } from './retry-classifier.js';
import { createKafkaCircuitBreaker } from './circuit-breaker.config.js';
import type { OutboxPublisherService } from './outbox-publisher.service.js';

@Injectable()
export class KafkaPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: PinoLogger;
  private readonly breakers = new Map<string, KafkaCircuitBreaker>();
  private readonly circuitState = new Map<string, 'open' | 'half-open' | 'closed'>();

  private readonly publishDuration: Histogram;
  private readonly publishSuccess: Counter;
  private readonly publishFailure: Counter;
  private readonly publishRetry: Counter;
  private readonly circuitGauge: ObservableGauge;

  constructor(
    @Inject(KAFKA_PUBLISHER_OPTIONS) private readonly options: KafkaPublisherOptions,
    @Inject(KAFKA_PRODUCER) private readonly producer: Producer,
    @Inject('PINO_LOGGER') logger: PinoLogger,
    private readonly outbox: OutboxPublisherService,
  ) {
    this.logger = logger.child({ component: 'KafkaPublisherService' });
    const meter = metrics.getMeter(this.options.observability.serviceName, '1.0.0');
    const prefix = this.options.observability.metricsPrefix;
    this.publishDuration = meter.createHistogram(`${prefix}_duration_ms`, {
      description: 'Duration of Kafka publish operations in milliseconds',
      unit: 'ms',
    });
    this.publishSuccess = meter.createCounter(`${prefix}_success_total`, {
      description: 'Total successful Kafka publishes',
    });
    this.publishFailure = meter.createCounter(`${prefix}_failure_total`, {
      description: 'Total failed Kafka publishes',
    });
    this.publishRetry = meter.createCounter(`${prefix}_retry_total`, {
      description: 'Total Kafka publish retry attempts',
    });
    this.circuitGauge = meter.createObservableGauge(`${prefix}_circuit_breaker_state`, {
      description: 'Circuit breaker state per topic (0=closed, 1=half-open, 2=open)',
    });
    this.circuitGauge.addCallback((result) => {
      for (const [topic, state] of this.circuitState.entries()) {
        const value = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
        result.observe(value, { topic });
      }
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.info(
      {
        brokers: this.options.brokers,
        clientId: this.options.clientId,
        idempotent: this.options.producer.idempotent,
        transactionalIdPrefix: this.options.producer.transactionalIdPrefix,
      },
      'Connecting Kafka producer',
    );
    await this.producer.connect();
    this.logger.info('Kafka producer connected successfully');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.info('Disconnecting Kafka producer (graceful shutdown)');
    try {
      await this.producer.disconnect();
    } catch (err) {
      this.logger.error({ err }, 'Error during Kafka producer disconnect');
    }
  }

  async publish<T>(
    topic: Topics,
    payload: T,
    publishOptions: PublishOptions = {},
  ): Promise<void> {
    const startMs = Date.now();
    const tracer = trace.getTracer(this.options.observability.serviceName);
    const span = tracer.startSpan('kafka.publish', {
      attributes: {
        'messaging.system': 'kafka',
        'messaging.destination': String(topic),
        'messaging.destination_kind': 'topic',
      },
    });

    let retryCount = 0;
    try {
      const schema = topicSchemaMap[topic];
      if (schema === undefined) {
        throw new TopicSchemaNotFoundError(String(topic));
      }
      const validation = schema.safeParse(payload);
      if (!validation.success) {
        throw new InvalidEventError(String(topic), validation.error.issues, {
          payloadKeys: Object.keys(payload as Record<string, unknown>),
        });
      }

      const tenantStore = kafkaTenantContext.getStore();
      if (tenantStore === undefined) {
        throw new MissingTenantContextError();
      }
      const tenantId = tenantStore.tenantId;

      const requestStore = kafkaRequestContext.getStore();
      const correlationId = requestStore?.correlationId ?? null;

      const carrier: Record<string, string> = {};
      propagation.inject(otelContext.active(), carrier);

      const envelope = buildEnvelope({
        topic,
        payload: validation.data as T,
        tenantId,
        userId: null,
        correlationId,
      });

      const serialized = Buffer.from(JSON.stringify(envelope), 'utf8');
      if (serialized.byteLength > this.options.producer.messageMaxBytes) {
        throw new MessageTooLargeError(
          String(topic),
          serialized.byteLength,
          this.options.producer.messageMaxBytes,
        );
      }

      span.setAttribute('messaging.message_id', envelope.event_id);
      span.setAttribute('messaging.kafka.message_key', tenantId);
      span.setAttribute('messaging.message_payload_size_bytes', serialized.byteLength);
      span.setAttribute('skalean.tenant_id', tenantId);

      const partitionKey = publishOptions.partitionKeyOverride ?? tenantId;
      const headers: Record<string, string> = {
        'tenant-id': tenantId,
        'event-id': envelope.event_id,
        'event-name': envelope.event_name,
        'event-version': envelope.event_version,
        ...(correlationId !== null ? { 'correlation-id': correlationId } : {}),
        ...(carrier['traceparent'] !== undefined ? { traceparent: carrier['traceparent'] } : {}),
        ...(carrier['tracestate'] !== undefined ? { tracestate: carrier['tracestate'] } : {}),
        ...(publishOptions.headers ?? {}),
      };

      const sendFn = async (): Promise<RecordMetadata[]> => {
        return this.producer.send({
          topic: String(topic),
          acks: this.options.producer.acks,
          compression: this.mapCompression(this.options.producer.compression),
          messages: [
            {
              key: partitionKey,
              value: serialized,
              headers,
            },
          ],
        });
      };

      const performWithRetry = async (): Promise<RecordMetadata[]> => {
        let lastErr: unknown = undefined;
        for (let attempt = 0; attempt <= this.options.retry.maxAttempts; attempt++) {
          try {
            const result = await sendFn();
            if (attempt > 0) {
              this.publishRetry.add(attempt, { topic: String(topic), outcome: 'success' });
            }
            return result;
          } catch (err) {
            lastErr = err;
            retryCount = attempt + 1;
            if (!isRetriableKafkaError(err)) {
              this.logger.error(
                { err, topic: String(topic), attempt, retriable: false, event_id: envelope.event_id },
                'Kafka publish failed with non-retriable error',
              );
              throw err;
            }
            if (attempt === this.options.retry.maxAttempts) break;
            const delay = computeBackoffMs(
              attempt,
              this.options.retry.initialDelayMs,
              this.options.retry.maxDelayMs,
              this.options.retry.jitter,
            );
            this.logger.warn(
              { err, topic: String(topic), attempt, delay_ms: delay, event_id: envelope.event_id },
              'Kafka publish failed, scheduling retry',
            );
            this.publishRetry.add(1, { topic: String(topic), outcome: 'retry' });
            await this.sleep(delay);
          }
        }
        throw lastErr;
      };

      let metadataList: RecordMetadata[];
      if (this.options.circuitBreaker.enabled && !(publishOptions.bypassCircuitBreaker ?? false)) {
        const breaker = this.getOrCreateBreaker(String(topic), performWithRetry);
        try {
          metadataList = (await breaker.fire()) as RecordMetadata[];
        } catch (err) {
          const isOpen =
            err instanceof Error &&
            (err.message.includes('Breaker is open') ||
              (err as Error & { code?: string }).code === 'EOPENBREAKER');
          if (isOpen) {
            const outboxFallback = publishOptions.outboxFallback ?? this.options.outbox.fallbackOnCircuitOpen;
            if (this.options.outbox.enabled && outboxFallback) {
              this.logger.warn(
                { topic: String(topic), event_id: envelope.event_id },
                'Circuit breaker open, falling back to outbox',
              );
              await this.outbox.enqueue(String(topic), envelope, partitionKey, headers);
              this.publishFailure.add(1, { topic: String(topic), error_type: 'circuit_open_outbox' });
              span.setStatus({ code: SpanStatusCode.OK, message: 'outbox_fallback' });
              return;
            }
            throw new CircuitBreakerOpenError(String(topic), this.options.circuitBreaker.resetMs);
          }
          throw err;
        }
      } else {
        metadataList = await performWithRetry();
      }

      const meta = metadataList[0];
      const durationMs = Date.now() - startMs;
      this.publishDuration.record(durationMs, { topic: String(topic), outcome: 'success' });
      this.publishSuccess.add(1, { topic: String(topic) });
      span.setAttribute('messaging.kafka.partition', meta?.partition ?? -1);
      span.setAttribute('messaging.kafka.offset', String(meta?.offset ?? -1));
      span.setStatus({ code: SpanStatusCode.OK });
      this.logger.info(
        {
          event_id: envelope.event_id,
          topic: String(topic),
          partition: meta?.partition,
          offset: meta?.offset,
          duration_ms: durationMs,
          retry_count: retryCount,
          tenant_id: tenantId,
          correlation_id: correlationId,
          payload_size_bytes: serialized.byteLength,
        },
        'Kafka event published',
      );
    } catch (err) {
      const durationMs = Date.now() - startMs;
      this.publishDuration.record(durationMs, { topic: String(topic), outcome: 'failure' });
      this.publishFailure.add(1, {
        topic: String(topic),
        error_type: err instanceof Error ? err.constructor.name : 'Unknown',
      });
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      this.logger.error(
        {
          err,
          topic: String(topic),
          duration_ms: durationMs,
          retry_count: retryCount,
        },
        'Kafka publish failed permanently',
      );
      if (
        err instanceof InvalidEventError ||
        err instanceof MissingTenantContextError ||
        err instanceof MessageTooLargeError ||
        err instanceof CircuitBreakerOpenError ||
        err instanceof TopicSchemaNotFoundError
      ) {
        throw err;
      }
      throw new KafkaPublishError(String(topic), err, retryCount);
    } finally {
      span.end();
    }
  }

  private getOrCreateBreaker(
    topic: string,
    fn: () => Promise<RecordMetadata[]>,
  ): KafkaCircuitBreaker {
    const existing = this.breakers.get(topic);
    if (existing !== undefined) return existing;
    const breaker = createKafkaCircuitBreaker(fn, {
      threshold: this.options.circuitBreaker.threshold,
      resetMs: this.options.circuitBreaker.resetMs,
      halfOpenAfterMs: this.options.circuitBreaker.halfOpenAfterMs,
      timeoutMs: this.options.circuitBreaker.timeoutMs,
      logger: this.logger,
      topic,
      onStateChange: (state) => {
        this.circuitState.set(topic, state);
      },
    });
    this.circuitState.set(topic, 'closed');
    this.breakers.set(topic, breaker);
    return breaker;
  }

  private mapCompression(
    c: KafkaPublisherOptions['producer']['compression'],
  ): CompressionTypes {
    switch (c) {
      case 'gzip': return CompressionTypes.GZIP;
      case 'snappy': return CompressionTypes.Snappy;
      case 'lz4': return CompressionTypes.LZ4;
      case 'zstd': return CompressionTypes.ZSTD;
      default: return CompressionTypes.None;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
