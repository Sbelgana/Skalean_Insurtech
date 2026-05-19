import { z } from 'zod';

export const KafkaPublisherOptionsSchema = z.object({
  brokers: z
    .array(z.string().regex(/^[^:]+:\d+$/, 'broker must be host:port'))
    .min(1, 'at least one broker required'),
  clientId: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'clientId must be lowercase kebab-case'),
  ssl: z.boolean().default(false),
  sasl: z
    .object({
      mechanism: z.enum(['plain', 'scram-sha-256', 'scram-sha-512']),
      username: z.string().min(1),
      password: z.string().min(1),
    })
    .optional(),
  producer: z.object({
    idempotent: z.boolean().default(true),
    transactionalIdPrefix: z.string().min(1),
    maxInFlightRequests: z.number().int().min(1).max(5).default(5),
    allowAutoTopicCreation: z.boolean().default(false),
    acks: z.union([z.literal(-1), z.literal(0), z.literal(1)]).default(-1),
    compression: z.enum(['none', 'gzip', 'snappy', 'lz4', 'zstd']).default('snappy'),
    messageMaxBytes: z.number().int().positive().default(1_048_576),
    requestTimeoutMs: z.number().int().positive().default(10_000),
    connectionTimeoutMs: z.number().int().positive().default(3_000),
  }),
  retry: z.object({
    maxAttempts: z.number().int().min(1).max(10).default(3),
    initialDelayMs: z.number().int().min(10).default(100),
    maxDelayMs: z.number().int().min(100).default(2_000),
    jitter: z.boolean().default(true),
  }),
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    threshold: z.number().int().min(1).max(50).default(5),
    resetMs: z.number().int().min(1_000).default(30_000),
    halfOpenAfterMs: z.number().int().min(1_000).default(15_000),
    timeoutMs: z.number().int().min(100).default(15_000),
  }),
  outbox: z.object({
    enabled: z.boolean().default(true),
    table: z.string().default('outbox_events'),
    fallbackOnCircuitOpen: z.boolean().default(true),
  }),
  observability: z.object({
    serviceName: z.string().min(1),
    metricsPrefix: z.string().default('kafka_publish'),
    sampleRate: z.number().min(0).max(1).default(1),
  }),
});

export type KafkaPublisherOptions = z.infer<typeof KafkaPublisherOptionsSchema>;

export interface PublishOptions {
  partitionKeyOverride?: string;
  headers?: Record<string, string>;
  bypassCircuitBreaker?: boolean;
  timeoutMsOverride?: number;
  outboxFallback?: boolean;
}

export const KAFKA_PUBLISHER_OPTIONS = Symbol('KAFKA_PUBLISHER_OPTIONS');
export const KAFKA_PRODUCER = Symbol('KAFKA_PRODUCER');
