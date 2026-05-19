import { type Topics } from '../topics.js';
import type { EventEnvelope } from '../types/event-envelope.js';
import { buildEventId } from './build-event-id.js';

export interface BuildEnvelopeInput<T> {
  topic: Topics;
  payload: T;
  tenantId: string | null;
  userId: string | null;
  correlationId: string | null;
  eventVersion?: string;
  occurredAt?: Date;
}

export function buildEnvelope<T>(input: BuildEnvelopeInput<T>): EventEnvelope<T> {
  return {
    event_id: buildEventId(),
    event_name: input.topic,
    event_version: input.eventVersion ?? '1.0',
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
    tenant_id: input.tenantId,
    user_id: input.userId,
    correlation_id: input.correlationId,
    payload: input.payload,
  };
}
