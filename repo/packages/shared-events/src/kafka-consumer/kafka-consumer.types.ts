import type { EventEnvelope } from '../types/event-envelope.js';

export interface RetryConfig {
  maxAttempts: number;
  initialMs: number;
  multiplier: number;
  maxMs: number;
}

export interface DlqMetadata {
  original_envelope: EventEnvelope<unknown>;
  error_class: string;
  error_message: string;
  stacktrace: string;
  attempt_count: number;
  consumer_group_id: string;
  source_topic: string;
  source_partition: number;
  source_offset: string;
  failed_at: string;
  error_type: 'validation_error' | 'transient_error';
}

export interface ConsumerOptions {
  retry?: {
    maxAttempts?: number;
    initialMs?: number;
    multiplier?: number;
    maxMs?: number;
  };
  dlq?: {
    enabled?: boolean;
    topicPrefix?: string;
  };
  session?: {
    timeoutMs?: number;
    heartbeatMs?: number;
  };
  observability?: {
    serviceName?: string;
    metricsPrefix?: string;
  };
  validationStrict?: boolean;
}

export interface ResolvedConsumerOptions {
  retry: RetryConfig;
  dlq: {
    enabled: boolean;
    topicPrefix: string;
  };
  session: {
    timeoutMs: number;
    heartbeatMs: number;
  };
  observability: {
    serviceName: string;
    metricsPrefix: string;
  };
  validationStrict: boolean;
}
